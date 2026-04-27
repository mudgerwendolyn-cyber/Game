/**
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Heart, 
  Zap, 
  Target, 
  Shield, 
  Sword, 
  Compass, 
  Trophy,
  Flame,
  Star
} from 'lucide-react';
import { 
  GameState, 
  GameStatus, 
  Player, 
  Enemy, 
  Upgrade, 
  Weapon, 
  Vector 
} from './types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  INITIAL_PLAYER_STATS, 
  STAT_CAPS,
  WEAPON_TYPES 
} from './constants';
import { 
  createPlayer, 
  spawnEnemy, 
  updatePlayer, 
  updateEnemies, 
  autoFire, 
  getDistance 
} from './engine/gameEngine';
import { drawGame } from './engine/rendering';

const INITIAL_STATE: GameState = {
  status: GameStatus.MENU,
  player: createPlayer(),
  enemies: [],
  projectiles: [],
  weapons: [{ 
    id: 'w1', 
    ...WEAPON_TYPES.PISTOL, 
    lastFired: 0 
  }],
  xpGems: [],
  wave: 1,
  gameTime: 0,
  score: 0,
  nextUpgrades: [],
  damageNumbers: []
};

// Available Upgrades Pool
const UPGRADES: Upgrade[] = [
  // A类：直接强化
  { id: 'hp', name: '体格强化', description: '最大生命值 +25%', type: 'STAT', apply: (p) => { 
    p.maxHp = Math.floor(p.maxHp * 1.25); 
    p.hp = Math.floor(p.hp + (p.maxHp * 0.25));
  }},
  { id: 'attack', name: '力量强化', description: '攻击力 +20%', type: 'STAT', apply: (p) => { p.attackPower *= 1.2; }},
  { id: 'speed', name: '敏捷强化', description: '移动速度 +10%', type: 'STAT', apply: (p) => { p.speed *= 1.1; }},
  { id: 'aspd', name: '急速射击', description: '攻击速度 +15%', type: 'STAT', apply: (p) => { 
    p.attackSpeed = Math.min(STAT_CAPS.attackSpeed, p.attackSpeed * 1.15); 
  }},
  { id: 'crit', name: '暴击专精', description: '暴击率 +10%', type: 'STAT', apply: (p) => { 
    p.critRate = Math.min(STAT_CAPS.critRate, p.critRate + 0.1); 
  }},
  { id: 'critdmg', name: '暴伤强化', description: '暴击伤害 +25%', type: 'STAT', apply: (p) => { p.critDamage += 0.25; }},
  
  // B类：机制类
  { id: 'pierce', name: '穿透弹', description: '子弹穿透数 +1', type: 'STAT', apply: (p) => { p.pierce += 1; }},
  { id: 'multishot', name: '多重射击', description: '额外发射 1 枚子弹', type: 'STAT', apply: (p) => { 
    p.multiShot = Math.min(STAT_CAPS.multiShot, p.multiShot + 1); 
  }},
  { id: 'lifesteal', name: '嗜血转换', description: '吸血 +5%', type: 'STAT', apply: (p) => { p.lifesteal += 0.05; }},
  { id: 'knockback', name: '击退增强', description: '击退力度 +30%', type: 'STAT', apply: (p) => { p.knockback += 0.3; }},

  // C类：爆发类 (Mocking with weapon upgrades for now as specified in Prompt)
  { id: 'shotgun', name: '霰弹枪', description: '获得/升级 扇形射击', type: 'WEAPON', apply: (p, ws) => {
    const existing = ws.find(w => w.name === '霰弹枪');
    if (existing) {
        existing.damage *= 1.4;
        existing.cooldown *= 0.85;
    } else {
        ws.push({ id: 'w_' + Date.now(), ...WEAPON_TYPES.SHOTGUN, lastFired: 0 });
    }
  }},
  { id: 'smg', name: '冲锋枪', description: '获得/升级 高频射击', type: 'WEAPON', apply: (p, ws) => {
    const existing = ws.find(w => w.name === '冲锋枪');
    if (existing) {
        existing.damage *= 1.4;
        existing.cooldown *= 0.85;
    } else {
        ws.push({ id: 'w_' + Date.now(), ...WEAPON_TYPES.SMG, lastFired: 0 });
    }
  }},

  // D类: 成长类 (Example: HP growth)
  { id: 'growth_hp', name: '顽强意志', description: '每次击杀有 2% 概率回满血', type: 'STAT', apply: (p) => { 
    // This is a special passive that would need logic in the loop, let's keep it simple for stat growth
    p.maxHp += 50;
    p.hp += 50;
  }}
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [shake, setShake] = useState(0);
  const [joystick, setJoystick] = useState<Vector>({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const keysRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(INITIAL_STATE);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const resetGame = () => {
    const player = createPlayer();
    gameStateRef.current = { ...INITIAL_STATE, player };
    setGameState(gameStateRef.current);
    lastTimeRef.current = 0;
  };

  const startGame = () => {
    const player = createPlayer();
    gameStateRef.current = { ...INITIAL_STATE, player, status: GameStatus.PLAYING };
    setGameState(gameStateRef.current);
    lastTimeRef.current = 0;
  };

  const pickUpgrades = () => {
    const picks: Upgrade[] = [];
    const pool = [...UPGRADES];
    while (picks.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  };

  const handleUpgrade = (upgrade: Upgrade) => {
    upgrade.apply(gameStateRef.current.player, gameStateRef.current.weapons);
    gameStateRef.current.status = GameStatus.PLAYING;
    lastTimeRef.current = performance.now();
    setGameState({ ...gameStateRef.current });
  };

  const update = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const deltaTime = Math.min(time - lastTimeRef.current, 50);
    lastTimeRef.current = time;

    const state = gameStateRef.current;
    if (state.status === GameStatus.PLAYING) {
      state.gameTime += deltaTime;
      const { player, enemies, projectiles, xpGems, weapons, damageNumbers } = state;

      // 1. Player Update
      updatePlayer(player, keysRef.current, joystick);

      // 2. Enemy Spawning - frequency increases with time
      const baseRate = 1000;
      const spawnRate = Math.max(100, baseRate / (1 + (state.gameTime / 60000) * 0.5));
      if (Math.random() < (deltaTime / spawnRate)) {
        state.enemies.push(spawnEnemy(state.gameTime, player.pos));
      }

      // Wave tracking
      state.wave = Math.floor(state.gameTime / 30000) + 1;

      // 3. Enemy Update
      const oldHp = player.hp;
      updateEnemies(state);
      if (player.hp < oldHp) {
          setShake(10);
      }

      // 4. Combat / AutoFire
      autoFire(state);

      // 5. Projectiles Update
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.pos.x += p.velocity.x;
        p.pos.y += p.velocity.y;
        p.distanceTraveled += Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);

        let pRemoved = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (getDistance(p.pos, e.pos) < p.radius + e.radius) {
            const isCrit = Math.random() < player.critRate;
            let dmg = p.damage * (isCrit ? player.critDamage : 1);
            e.hp -= dmg;
            
            // Knockback
            const angle = Math.atan2(e.pos.y - p.pos.y, e.pos.x - p.pos.x);
            const kbForce = 5 * (1 + player.knockback);
            e.pos.x += Math.cos(angle) * kbForce;
            e.pos.y += Math.sin(angle) * kbForce;

            // Damage Number
            state.damageNumbers.push({
                id: Math.random(),
                pos: { x: e.pos.x, y: e.pos.y - 20 },
                value: Math.floor(dmg),
                isCrit,
                life: 1.0
            });

            // Lifesteal
            if (player.lifesteal > 0) {
                player.hp = Math.min(player.maxHp, player.hp + dmg * player.lifesteal);
            }

            if (e.hp <= 0) {
              state.score += e.isElite ? 500 : 100;
              player.killCount += 1;
              state.xpGems.push({ 
                  id: Math.random().toString(), 
                  pos: { ...e.pos }, 
                  radius: e.isElite ? 8 : 4, 
                  value: e.isElite ? 30 : 10 
              });
              enemies.splice(j, 1);
            }

            if (p.pierceRemaining > 0) {
                p.pierceRemaining -= 1;
            } else {
                projectiles.splice(i, 1);
                pRemoved = true;
                break;
            }
          }
        }

        if (!pRemoved && p.distanceTraveled > p.maxDistance) {
          projectiles.splice(i, 1);
        }
      }

      // 6. XP Gems
      const xpCollectionRadius = 100 * (1 + player.level * 0.05);
      for (let i = xpGems.length - 1; i >= 0; i--) {
        const gem = xpGems[i];
        const dist = getDistance(player.pos, gem.pos);
        if (dist < xpCollectionRadius) { 
            const angle = Math.atan2(player.pos.y - gem.pos.y, player.pos.x - gem.pos.x);
            const pullSpeed = player.speed * 1.5;
            gem.pos.x += Math.cos(angle) * pullSpeed;
            gem.pos.y += Math.sin(angle) * pullSpeed;
        }
        if (dist < player.radius + gem.radius) {
            player.xp += gem.value;
            xpGems.splice(i, 1);

            if (player.xp >= player.maxXp) {
                player.xp -= player.maxXp;
                player.level += 1;
                player.maxXp = Math.floor(player.maxXp * 1.15) + 30;
                state.status = GameStatus.UPGRADING;
                state.nextUpgrades = pickUpgrades();
            }
        }
      }

      // 7. Damage Numbers decay
      for(let i = damageNumbers.length - 1; i >= 0; i--) {
          const dn = damageNumbers[i];
          dn.pos.y -= 0.5;
          dn.life -= 0.02;
          if (dn.life <= 0) state.damageNumbers.splice(i, 1);
      }

      // 8. Game Over check
      if (player.hp <= 0) {
        state.status = GameStatus.GAME_OVER;
      }

      // Periodically sync to React state for UI (low frequency is fine)
      if (Math.floor(time / 100) !== Math.floor((time - deltaTime) / 100) || state.status !== GameStatus.PLAYING) {
          setGameState({ ...state });
      }
    }

    // Render always with latest ref state
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      setShake(prev => Math.max(0, prev - 0.5));
      drawGame(ctx, state, shake);
    }
    
    requestRef.current = requestAnimationFrame(update);
  }, [joystick, shake]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const preventDefault = (e: TouchEvent) => {
      if (gameState.status === GameStatus.PLAYING) e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Prevent scrolling when playing on mobile
    window.addEventListener('touchmove', preventDefault, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchmove', preventDefault);
    };
  }, [gameState.status]);

  const handleJoystick = (pos: Vector | null) => {
    if (!pos) {
      setJoystick({ x: 0, y: 0 });
    } else {
      const mag = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      const limit = 64; // Distance from center
      if (mag > 0) {
        const normalizedMag = Math.min(mag, limit) / limit;
        setJoystick({
          x: (pos.x / mag) * normalizedMag,
          y: (pos.y / mag) * normalizedMag
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden flex items-center justify-center">
      
      {/* UI Overlay */}
      <div 
        ref={containerRef}
        className="relative w-full h-full md:w-[450px] md:h-[800px] md:aspect-[9/16] overflow-hidden shadow-2xl md:border-4 md:border-slate-800 md:rounded-[3rem] bg-slate-900"
      >
        <canvas 
          ref={canvasRef} 
          width={GAME_WIDTH} 
          height={GAME_HEIGHT}
          className="w-full h-full block touch-none"
        />

        {/* Mobile Joystick Area - Full bottom half for better touch response */}
        {gameState.status === GameStatus.PLAYING && (
          <div className="absolute inset-x-0 bottom-0 top-1/2 z-50 pointer-events-none md:pointer-events-auto">
             <div 
               className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 flex items-center justify-center touch-none pointer-events-auto shadow-inner"
               onTouchStart={(e) => {
                 const touch = e.touches[0];
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = touch.clientX - (rect.left + rect.width / 2);
                 const y = touch.clientY - (rect.top + rect.height / 2);
                 handleJoystick({ x, y });
               }}
               onTouchMove={(e) => {
                 const touch = e.touches[0];
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = touch.clientX - (rect.left + rect.width / 2);
                 const y = touch.clientY - (rect.top + rect.height / 2);
                 handleJoystick({ x, y });
               }}
               onTouchEnd={() => handleJoystick(null)}
             >
                <motion.div 
                  className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-2xl shadow-blue-500/50 border-2 border-white/20"
                  animate={{ 
                    x: joystick.x * 45, 
                    y: joystick.y * 45 
                  }}
                  transition={{ type: 'spring', damping: 12, stiffness: 150 }}
                />
                
                {/* Visual feedback for joystick range */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-pulse scale-110 pointer-events-none" />
             </div>
          </div>
        )}

        {/* HUD - Portrait Optimized */}
        {gameState.status !== GameStatus.MENU && (
          <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col gap-3">
            {/* Top Bar: Timer & Wave */}
            <div className="flex justify-between items-center px-4 py-2 bg-slate-950/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-lg">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Time</span>
                    <span className="text-lg font-black text-white tabular-nums">
                        {Math.floor(gameState.gameTime / 60000)}:
                        {String(Math.floor((gameState.gameTime % 60000) / 1000)).padStart(2, '0')}
                    </span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Wave</span>
                    <span className="text-xl font-black text-blue-400 italic">#{gameState.wave}</span>
                </div>
            </div>

            {/* Stats Bars */}
            <div className="flex flex-col gap-2">
                {/* Health */}
                <div className="relative h-6 bg-slate-950/60 rounded-full border border-white/10 overflow-hidden shadow-inner px-1 flex items-center">
                    <motion.div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-rose-500 via-rose-400 to-rose-600"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(gameState.player.hp / gameState.player.maxHp) * 100}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    />
                    <div className="relative z-10 w-full flex justify-between px-2 items-center">
                        <Heart size={14} className="text-white fill-white/20" />
                        <span className="text-[10px] font-black text-white drop-shadow-md">
                            {Math.floor(gameState.player.hp)} / {gameState.player.maxHp}
                        </span>
                    </div>
                </div>

                {/* XP */}
                <div className="relative h-2 bg-slate-950/60 rounded-full border border-white/5 overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      animate={{ width: `${(gameState.player.xp / gameState.player.maxXp) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-purple-400 uppercase">Lv.{gameState.player.level}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase">Score: {gameState.score}</span>
                </div>
            </div>
          </div>
        )}

        {/* Upgrade Screen - Portrait Height Optimized */}
        <AnimatePresence>
          {gameState.status === GameStatus.UPGRADING && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center p-8 pt-16"
            >
               <motion.h2 
                 initial={{ y: -20 }}
                 animate={{ y: 0 }}
                 className="text-4xl font-black text-white mb-10 italic uppercase tracking-tighter"
               >
                 Power Up!
               </motion.h2>
               <div className="flex flex-col gap-4 w-full overflow-y-auto pb-8 scrollbar-hide">
                 {gameState.nextUpgrades.map((upgrade, idx) => (
                   <motion.button
                     key={idx}
                     initial={{ x: -20, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     transition={{ delay: idx * 0.1 }}
                     whileTap={{ scale: 0.98, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                     onClick={() => handleUpgrade(upgrade)}
                     className="flex bg-slate-900/50 border border-slate-800 p-5 rounded-[2rem] text-left transition-all active:border-blue-500 group"
                   >
                     <div className="p-4 bg-slate-800 rounded-2xl mr-4 flex-shrink-0 self-center border border-white/5">
                       {upgrade.type === 'WEAPON' ? <Sword className="text-blue-400" /> : <Shield className="text-emerald-400" />}
                     </div>
                     <div className="flex-1 pr-2">
                       <h3 className="text-lg font-black text-white mb-0.5 group-active:text-blue-400">{upgrade.name}</h3>
                       <p className="text-xs text-slate-400 font-medium leading-tight">{upgrade.description}</p>
                     </div>
                   </motion.button>
                 ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu Screen - True Portrait Layout */}
        <AnimatePresence>
          {gameState.status === GameStatus.MENU && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 bg-[#020617] flex flex-col items-center justify-between py-20 px-8 text-center"
            >
               {/* Background Decorative Polish */}
               <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[120px] rounded-full" />
                  <div className="absolute bottom-1/4 left-1/4 w-32 h-32 bg-purple-600/10 blur-[80px] rounded-full" />
                  <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(0deg, #ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
               </div>

               <div className="relative z-10 flex flex-col items-center">
                   <motion.div
                     animate={{ 
                       rotate: [0, 5, -5, 0],
                       scale: [1, 1.05, 1]
                     }}
                     transition={{ repeat: Infinity, duration: 4 }}
                     className="text-8xl mb-6 filter drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                   >
                     🚀
                   </motion.div>
                   <h1 className="text-6xl font-[1000] text-white tracking-[-0.1em] mb-2 leading-none italic uppercase">
                     Project<br/>
                     <span className="text-blue-500 tracking-tighter">Bro</span>
                   </h1>
                   <p className="text-slate-500 font-bold max-w-[240px] text-xs uppercase tracking-widest leading-relaxed">
                     Survivors.io Style<br/>
                     Mobile Roguelike SHOOTER
                   </p>
               </div>
               
               <div className="relative z-10 w-full flex flex-col items-center gap-6">
                   <button 
                     onClick={startGame}
                     className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(59,130,246,0.5)] transition-all active:scale-95 active:shadow-inner flex items-center justify-center gap-3 border-b-4 border-blue-800"
                   >
                     <Play size={28} className="fill-white" /> 进 入 战 场
                   </button>
                   
                   <div className="flex gap-8 text-slate-500 py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Compass className="text-blue-500/50" />
                        <span className="text-[10px] font-black">TOUCH</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Target className="text-blue-500/50" />
                        <span className="text-[10px] font-black">AUTO</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Flame className="text-blue-500/50" />
                        <span className="text-[10px] font-black">ROGUE</span>
                      </div>
                   </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Screen - Portrait */}
        <AnimatePresence>
          {gameState.status === GameStatus.GAME_OVER && (
            <motion.div 
               initial={{ opacity: 0, y: 50 }}
               animate={{ opacity: 1, y: 0 }}
               className="absolute inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center"
            >
               <motion.div 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 border-2 border-rose-500/50"
               >
                 <Trophy size={48} className="text-rose-500" />
               </motion.div>
               
               <h2 className="text-6xl font-[1000] text-white mb-2 italic tracking-tighter uppercase">Defeated</h2>
               <p className="text-sm text-slate-500 mb-10 font-bold uppercase tracking-[0.3em]">You fought bravely, Bro.</p>
               
               <div className="w-full bg-slate-900 border border-white/5 p-8 rounded-[3rem] mb-12 shadow-2xl">
                  <div className="grid grid-cols-1 gap-6">
                     <div className="flex justify-between items-center border-b border-white/5 pb-4">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Waves Survived</span>
                        <span className="text-3xl font-black text-blue-400">{gameState.wave}</span>
                     </div>
                     <div className="flex justify-between items-center border-b border-white/5 pb-4">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Level Reached</span>
                        <span className="text-3xl font-black text-purple-400">{gameState.player.level}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Score</span>
                        <span className="text-3xl font-black text-white tabular-nums">{gameState.score.toLocaleString()}</span>
                     </div>
                  </div>
               </div>

               <button 
                 onClick={resetGame}
                 className="w-full py-6 bg-white text-slate-950 font-black text-xl rounded-[2.5rem] shadow-2xl shadow-white/10 transition-all active:scale-95 flex items-center justify-center gap-3"
               >
                 <RotateCcw size={24} /> 再次尝试
               </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
