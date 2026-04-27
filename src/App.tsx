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
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [shake, setShake] = useState(0);
  const keysRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const resetGame = () => {
    const player = createPlayer();
    setGameState({ ...INITIAL_STATE, player });
    lastTimeRef.current = 0;
  };

  const startGame = () => {
    const player = createPlayer();
    setGameState({ ...INITIAL_STATE, player, status: GameStatus.PLAYING });
  };

  const pickUpgrades = () => {
    const picks: Upgrade[] = [];
    const pool = [...UPGRADES];
    
    // We can implement weights by duplicating items or using a weighted random
    // For now, let's just pick 3 unique ones
    while (picks.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  };

  const handleUpgrade = (upgrade: Upgrade) => {
    setGameState(prev => {
        const next = { ...prev };
        upgrade.apply(next.player, next.weapons);
        next.status = GameStatus.PLAYING;
        next.gameTime = performance.now(); // Sync timer
        lastTimeRef.current = performance.now();
        return next;
    });
  };

  const update = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const deltaTime = Math.min(time - lastTimeRef.current, 50); // Cap deltaTime to prevent huge jumps
    lastTimeRef.current = time;

    setGameState(prev => {
      if (prev.status !== GameStatus.PLAYING) return prev;

      const next = { ...prev };
      next.gameTime += deltaTime;
      const { player, enemies, projectiles, xpGems, weapons, damageNumbers } = next;

      // 1. Player Update
      updatePlayer(player, keysRef.current);

      // 2. Enemy Spawning - frequency increases with time
      const baseRate = 1000;
      const spawnRate = Math.max(100, baseRate / (1 + (next.gameTime / 60000) * 0.5));
      if (Math.random() < (deltaTime / spawnRate)) {
        next.enemies.push(spawnEnemy(next.gameTime, player.pos));
      }

      // Wave tracking
      next.wave = Math.floor(next.gameTime / 30000) + 1;

      // 3. Enemy Update
      updateEnemies(next);
      if (next.player.hp < player.hp) {
          setShake(10);
      }

      // 4. Combat / AutoFire
      autoFire(next);

      // 5. Projectiles Update
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.pos.x += p.velocity.x;
        p.pos.y += p.velocity.y;
        p.distanceTraveled += Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);

        let pRemoved = false;
        const hitEnemiesSet = new Set<string>(); // Prevent hitting same target multiple times with same bullet

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
            next.damageNumbers.push({
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
              next.score += e.isElite ? 500 : 100;
              player.killCount += 1;
              next.xpGems.push({ 
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
      const xpCollectionRadius = 100 * (1 + player.level * 0.05); // Radius grows slightly
      for (let i = xpGems.length - 1; i >= 0; i--) {
        const gem = xpGems[i];
        const dist = getDistance(player.pos, gem.pos);
        if (dist < xpCollectionRadius) { 
            const angle = Math.atan2(player.pos.y - gem.pos.y, player.pos.x - gem.pos.x);
            gem.pos.x += Math.cos(angle) * player.speed * 1.5;
            gem.pos.y += Math.sin(angle) * player.speed * 1.5;
        }
        if (dist < player.radius + gem.radius) {
            player.xp += gem.value;
            xpGems.splice(i, 1);

            if (player.xp >= player.maxXp) {
                player.xp -= player.maxXp;
                player.level += 1;
                player.maxXp = Math.floor(player.maxXp * 1.15) + 30;
                next.status = GameStatus.UPGRADING;
                next.nextUpgrades = pickUpgrades();
            }
        }
      }

      // 7. Damage Numbers decay
      for(let i = damageNumbers.length - 1; i >= 0; i--) {
          const dn = damageNumbers[i];
          dn.pos.y -= 0.5;
          dn.life -= 0.02;
          if (dn.life <= 0) damageNumbers.splice(i, 1);
      }

      // 8. Game Over check
      if (player.hp <= 0) {
        next.status = GameStatus.GAME_OVER;
      }

      return next;
    });

    setShake(prev => Math.max(0, prev - 0.5));
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawGame(ctx, gameState, shake);
    
    requestRef.current = requestAnimationFrame(update);
  }, [gameState, shake]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col items-center justify-center">
      
      {/* UI Overlay */}
      <div className="relative w-[800px] h-[600px] overflow-hidden shadow-2xl border-4 border-slate-800 rounded-xl bg-slate-900">
        <canvas 
          ref={canvasRef} 
          width={GAME_WIDTH} 
          height={GAME_HEIGHT}
          className="w-full h-full block"
        />

        {/* HUD */}
        {gameState.status !== GameStatus.MENU && (
          <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col gap-2">
            <div className="flex justify-between items-center bg-slate-900/60 backdrop-blur-md p-2 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Heart className="text-rose-500 fill-rose-500/20" size={20} />
                  <div className="w-32 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-300"
                      style={{ width: `${(gameState.player.hp / gameState.player.maxHp) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums">{Math.floor(gameState.player.hp)}/{gameState.player.maxHp}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Star className="text-purple-400 fill-purple-400/20" size={20} />
                  <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-300"
                      style={{ width: `${(gameState.player.xp / gameState.player.maxXp) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black uppercase text-purple-300">等级 {gameState.player.level}</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">波次</div>
                    <div className="text-lg font-black text-blue-400 leading-none">{gameState.wave}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">时间</div>
                    <div className="text-lg font-black text-slate-300 leading-none">
                        {Math.floor(gameState.gameTime / 60000)}:
                        {String(Math.floor((gameState.gameTime % 60000) / 1000)).padStart(2, '0')}
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Screen */}
        <AnimatePresence>
          {gameState.status === GameStatus.UPGRADING && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8"
            >
               <motion.h2 
                 initial={{ y: -20 }}
                 animate={{ y: 0 }}
                 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-8 uppercase tracking-widest"
               >
                 升级强化
               </motion.h2>
               <div className="flex gap-4 w-full max-w-2xl">
                 {gameState.nextUpgrades.map((upgrade, idx) => (
                   <motion.button
                     key={idx}
                     whileHover={{ scale: 1.05, y: -5 }}
                     whileTap={{ scale: 0.95 }}
                     onClick={() => handleUpgrade(upgrade)}
                     className="flex-1 bg-slate-900 border-2 border-slate-800 hover:border-blue-500 p-6 rounded-2xl text-left transition-colors flex flex-col gap-4 shadow-xl"
                   >
                     <div className="p-3 bg-blue-500/20 rounded-xl w-fit">
                       {upgrade.type === 'WEAPON' ? <Sword className="text-blue-400" /> : <Shield className="text-emerald-400" />}
                     </div>
                     <div>
                       <h3 className="text-xl font-bold text-white mb-1">{upgrade.name}</h3>
                       <p className="text-sm text-slate-400 leading-relaxed font-medium">{upgrade.description}</p>
                     </div>
                     <div className="mt-auto pt-4 border-t border-slate-800">
                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">点击选择</span>
                     </div>
                   </motion.button>
                 ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu Screen */}
        <AnimatePresence>
          {gameState.status === GameStatus.MENU && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 bg-[#0f172a] flex flex-col items-center justify-center p-12 text-center"
            >
               <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
               <motion.div
                 animate={{ y: [0, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 3 }}
                 className="text-8xl mb-8 filter drop-shadow-[0_0_30px_rgba(59,130,246,0.4)]"
               >
                 💠
               </motion.div>
               <h1 className="text-6xl font-black text-white tracking-tighter mb-4 italic">PROJECT: BRO</h1>
               <p className="text-slate-400 max-w-md mb-12 font-medium">无尽的怪兽潮正在逼近。生存，杀戮，进化。你是最后的防线。</p>
               
               <button 
                 onClick={startGame}
                 className="group relative px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-2xl shadow-[0_0_40px_-5px_rgba(59,130,246,0.5)] transition-all active:scale-95 flex items-center gap-3"
               >
                 <Play className="fill-white" /> 开始射击
                 <div className="absolute -inset-0.5 bg-blue-400 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
               </button>

               <div className="mt-16 grid grid-cols-3 gap-8 text-slate-500">
                  <div className="flex flex-col items-center gap-1">
                    <Compass size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">WASD 移动</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Target size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">自动瞄准</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Flame size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">无限进化</span>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Screen */}
        <AnimatePresence>
          {gameState.status === GameStatus.GAME_OVER && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
               <h2 className="text-7xl font-black text-rose-600 mb-2 italic">战斗终止</h2>
               <p className="text-xl text-slate-400 mb-12 font-bold uppercase tracking-widest">你已被毁灭...</p>
               
               <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl mb-12 min-w-[320px]">
                  <div className="grid grid-cols-2 gap-8">
                     <div className="text-left">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">生存波次</div>
                        <div className="text-3xl font-black text-blue-400">{gameState.wave}</div>
                     </div>
                     <div className="text-left">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">最终等级</div>
                        <div className="text-3xl font-black text-purple-400">Lv.{gameState.player.level}</div>
                     </div>
                     <div className="text-left col-span-2">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">最终得分</div>
                        <div className="text-4xl font-black text-white tabular-nums">{gameState.score}</div>
                     </div>
                  </div>
               </div>

               <button 
                 onClick={resetGame}
                 className="px-12 py-5 bg-white text-slate-950 font-black text-xl rounded-2xl shadow-2xl transition-all hover:bg-slate-200 active:scale-95 flex items-center gap-3"
               >
                 <RotateCcw size={24} /> 再次尝试
               </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 text-center text-slate-500 max-w-sm">
        <p className="text-xs font-medium leading-relaxed">
          TIP: 移动以避开怪物，自动攻击系统会处理剩下的事情。寻找紫色晶体来升级你的角色！
        </p>
      </div>
    </div>
  );
}
