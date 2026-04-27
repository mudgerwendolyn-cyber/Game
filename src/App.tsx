/**
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
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
  Star,
  Pause,
  X,
  Share2,
  Check,
  Home,
  Copy
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
  updateProjectiles,
  getDistance,
  spawnParticle,
  spawnDamageNumber,
  updateJuice
} from './engine/gameEngine';
import { drawGame } from './engine/rendering';
import { audio } from './engine/audio';

const getInitialState = (): GameState => ({
  status: GameStatus.MENU,
  player: createPlayer(),
  players: {}, // For multiplayer
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
  level: 1,
  experience: 0,
  experienceToNextLevel: 100,
  nextUpgrades: [],
  damageNumbers: [],
  particles: []
});

// Available Upgrades Pool
const UPGRADES: Upgrade[] = [
  // A类：直接强化 (Tightened)
  { id: 'hp', name: '体格强化', description: '最大生命值 +20%', type: 'STAT', apply: (p) => { 
    p.maxHp = Math.floor(p.maxHp * 1.20); 
    p.hp = Math.floor(p.hp + (p.maxHp * 0.20));
  }},
  { id: 'attack', name: '力量强化', description: '攻击力 +12%', type: 'STAT', apply: (p) => { p.attackPower *= 1.12; }},
  { id: 'speed', name: '敏捷强化', description: '移动速度 +1%', type: 'STAT', apply: (p) => { p.speed *= 1.01; }},
  { id: 'aspd', name: '急速射击', description: '攻击速度 +15%', type: 'STAT', apply: (p) => { 
    p.attackSpeed = Math.min(STAT_CAPS.attackSpeed, p.attackSpeed * 1.15); 
  }},
  { id: 'crit', name: '暴击专精', description: '暴击率 +5%', type: 'STAT', apply: (p) => { 
    p.critRate = Math.min(STAT_CAPS.critRate, p.critRate + 0.05); 
  }},
  { id: 'critdmg', name: '暴伤强化', description: '暴击伤害 +20%', type: 'STAT', apply: (p) => { p.critDamage += 0.20; }},
  
  // B类：机制类 (Capped)
  { id: 'pierce', name: '穿透弹', description: '子弹穿透数 +1 (上限2)', type: 'STAT', apply: (p) => { 
    p.pierce = Math.min(STAT_CAPS.pierce, p.pierce + 1); 
  }},
  { id: 'multishot', name: '多重射击', description: '额外发射 1 枚子弹 (上限6)', type: 'STAT', apply: (p) => { 
    p.multiShot = Math.min(STAT_CAPS.multiShot, p.multiShot + 1); 
  }},
  { id: 'lifesteal', name: '嗜血转换', description: '吸血 +1% (上限5%)', type: 'STAT', apply: (p) => { 
    p.lifesteal = Math.min(STAT_CAPS.lifesteal, p.lifesteal + 0.01); 
  }},
  { id: 'knockback', name: '击退增强', description: '击退力度 +20%', type: 'STAT', apply: (p) => { p.knockback += 0.2; }},

  // C类：武技类
  { id: 'shotgun', name: '霰弹枪', description: '获得/升级 扇形射击', type: 'WEAPON', apply: (p, ws) => {
    const existing = ws.find(w => w.name === '霰弹枪');
    if (existing) {
        existing.damage *= 1.25;
        existing.cooldown *= 0.9;
    } else {
        ws.push({ id: 'w_' + Date.now(), ...WEAPON_TYPES.SHOTGUN, lastFired: 0 });
    }
  }},
  { id: 'smg', name: '冲锋枪', description: '获得/升级 高频射击', type: 'WEAPON', apply: (p, ws) => {
    const existing = ws.find(w => w.name === '冲锋枪');
    if (existing) {
        existing.damage *= 1.25;
        existing.cooldown *= 0.9;
    } else {
        ws.push({ id: 'w_' + Date.now(), ...WEAPON_TYPES.SMG, lastFired: 0 });
    }
  }},
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>(getInitialState());
  const [shake, setShake] = useState(0);
  const [joystick, setJoystick] = useState<Vector>({ x: 0, y: 0 });
  const [joystickCenter, setJoystickCenter] = useState<Vector | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const keysRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(getInitialState());
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [roomUsers, setRoomUsers] = useState<number>(1);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [joinId, setJoinId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);

  // Persistence logic
  const saveGame = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status === GameStatus.MENU || state.status === GameStatus.GAME_OVER) return;
    if (isMultiplayer) return; // Don't save multiplayer state locally

    const saveData = {
        player: state.player,
        weapons: state.weapons,
        wave: state.wave,
        score: state.score,
        gameTime: state.gameTime,
        xpGems: state.xpGems, // Maybe too many? Let's save gems too
        enemies: state.enemies.map(e => ({...e, currentDir: null})) // CurrentDir might have complex state
    };
    localStorage.setItem('coreblast_save', JSON.stringify(saveData));
    setHasSavedGame(true);
  }, [isMultiplayer]);

  const loadGame = () => {
    const saved = localStorage.getItem('coreblast_save');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        if (data.player.hp <= 0) return;

        const newState: GameState = {
            ...getInitialState(),
            ...data,
            status: GameStatus.PLAYING
        };
        gameStateRef.current = newState;
        setGameState({ ...newState });
        lastTimeRef.current = 0;
        audio.playSFX('click');
    } catch (e) {
        console.error('Failed to load game', e);
    }
  };

  const backToMenu = () => {
    gameStateRef.current.status = GameStatus.MENU;
    setGameState({ ...gameStateRef.current });
    audio.playSFX('click');
  };

  useEffect(() => {
    const saved = localStorage.getItem('coreblast_save');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.player.hp > 0) setHasSavedGame(true);
        } catch(e) {}
    }
  }, []);

  // Periodic Auto-Save
  useEffect(() => {
    const interval = setInterval(() => {
        saveGame();
    }, 5000);
    return () => clearInterval(interval);
  }, [saveGame]);

  useEffect(() => {
    const startAudio = () => {
      // Play a short silent/UI sound to unlock audio context for mobile
      audio.playSFX('click');
      window.removeEventListener('click', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
    window.addEventListener('click', startAudio);
    window.addEventListener('touchstart', startAudio);
    return () => {
      window.removeEventListener('click', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
  }, []);

  useEffect(() => {
    socketRef.current = io({
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnectionAttempts: 5
    });
    setupSocketListeners();
    
    // Check URL params after setup
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setTimeout(() => joinExistingRoom(roomFromUrl), 500); // Small delay to ensure socket readiness
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const createRoom = () => {
    setIsMultiplayer(true);
    setIsHost(true);
    setRoomUsers(1);
    gameStateRef.current.status = GameStatus.LOBBY;
    setGameState({ ...gameStateRef.current });

    if (!socketRef.current?.connected) {
      setIsConnecting(true);
      const timeout = setTimeout(() => {
        setIsConnecting(false);
        setErrorStatus('连接超时。如无法连接，请尝试切换网络或开启网页加速工具。');
        setIsMultiplayer(false);
        gameStateRef.current.status = GameStatus.MENU;
        setGameState({ ...gameStateRef.current });
        setTimeout(() => setErrorStatus(null), 5000);
      }, 8000);

      socketRef.current?.connect();
      socketRef.current?.once('connect', () => {
        clearTimeout(timeout);
        socketRef.current?.emit('create_room');
        setIsConnecting(false);
      });
    } else {
      socketRef.current.emit('create_room');
    }
  };

  const joinExistingRoom = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;

    setIsMultiplayer(true);
    setIsHost(false);
    gameStateRef.current.status = GameStatus.LOBBY;
    setGameState({ ...gameStateRef.current });

    if (!socketRef.current?.connected) {
      setIsConnecting(true);
      const timeout = setTimeout(() => {
        setIsConnecting(false);
        setErrorStatus('连接超时。部分地区可能需要开启加速工具以使用联机功能。');
        setIsMultiplayer(false);
        gameStateRef.current.status = GameStatus.MENU;
        setGameState({ ...gameStateRef.current });
        setTimeout(() => setErrorStatus(null), 5000);
      }, 8000);

      socketRef.current?.connect();
      socketRef.current?.once('connect', () => {
        clearTimeout(timeout);
        socketRef.current?.emit('join_room', cleanId);
        setIsConnecting(false);
      });
    } else {
      socketRef.current.emit('join_room', cleanId);
    }
  };

  const leaveRoom = () => {
    socketRef.current?.disconnect();
    setIsMultiplayer(false);
    setIsHost(false);
    setRoomId(null);
    setRoomUsers(1);
    const newState = getInitialState();
    gameStateRef.current = newState;
    setGameState({ ...newState });
    window.history.replaceState({}, '', window.location.pathname);
    
    // Re-init socket for next potential game
    socketRef.current = io({
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnectionAttempts: 5
    });
    setupSocketListeners();
  };

  const setupSocketListeners = () => {
    const s = socketRef.current;
    if (!s) return;

    s.on('room_created', (id) => {
      setRoomId(id);
      setJoinId('');
      window.history.replaceState({}, '', `?room=${id}`);
    });

    s.on('room_update', ({ members, roomId: sRoomId, host }) => {
      setRoomUsers(members.length);
      setIsHost(s.id === host);
      if (sRoomId) {
        setRoomId(sRoomId); 
        setJoinId('');
      }
    });

    s.on('room_error', (msg) => {
      setErrorStatus(msg);
      setRoomId(null); 
      setIsMultiplayer(false);
      gameStateRef.current.status = GameStatus.MENU;
      setGameState({ ...gameStateRef.current });
      setTimeout(() => setErrorStatus(null), 3000);
    });

    s.on('connect_error', () => {
      setErrorStatus('无法连接到服务器。部分地区（如中国大陆）可能需要辅助工具才能使用多人功能。');
      setIsConnecting(false);
      setIsMultiplayer(false);
      gameStateRef.current.status = GameStatus.MENU;
      setGameState({ ...gameStateRef.current });
      setTimeout(() => setErrorStatus(null), 5000);
    });

    s.on('game_started', () => {
      const player = gameStateRef.current.player;
      gameStateRef.current.status = GameStatus.PLAYING;
      setGameState({ ...gameStateRef.current });
      lastTimeRef.current = 0;
      
      gameStateRef.current.player.id = s.id || 'player';
      s.emit('join', { 
        pos: player.pos, 
        hp: player.hp, 
        level: player.level,
        radius: player.radius
      });
    });

    s.on('players_update', (players) => {
      gameStateRef.current.players = players;
    });

    s.on('player_moved', ({ id, pos }) => {
      if (gameStateRef.current.players[id]) {
        gameStateRef.current.players[id].pos = pos;
      }
    });

    s.on('player_state_update', ({ id, state }) => {
      if (gameStateRef.current.players[id]) {
        gameStateRef.current.players[id] = { ...gameStateRef.current.players[id], ...state };
      }
    });
  };

  const handleStartMultiplayerGame = () => {
    if (roomUsers < 2) {
      setErrorStatus('需要至少两名玩家');
      setTimeout(() => setErrorStatus(null), 3000);
      return;
    }
    socketRef.current?.emit('start_game', roomId);
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const resetGame = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsMultiplayer(false);
    setRoomUsers(1);
    setRoomId(null);
    setIsHost(false);
    window.history.replaceState({}, '', window.location.pathname);
    const player = createPlayer();
    const newState = { ...getInitialState(), player, status: GameStatus.MENU };
    gameStateRef.current = newState;
    setGameState({ ...newState });
    lastTimeRef.current = 0;
  };

  const [copied, setCopied] = useState(false);

  const handleCopyRoomId = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const shareUrl = roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : window.location.href;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = () => {
    setIsMultiplayer(false);
    const player = createPlayer();
    gameStateRef.current = { ...getInitialState(), player, status: GameStatus.PLAYING };
    setGameState(gameStateRef.current);
    lastTimeRef.current = 0;
    // Clear save when starting a completely new game
    localStorage.removeItem('coreblast_save');
    setHasSavedGame(false);
  };

  const startMultiplayer = () => {
    createRoom();
  };

  const togglePause = () => {
    if (isMultiplayer) return; // Cannot pause in multiplayer
    setGameState(prev => {
      const newStatus = prev.status === GameStatus.PLAYING ? GameStatus.PAUSED : GameStatus.PLAYING;
      gameStateRef.current.status = newStatus;
      return { ...prev, status: newStatus };
    });
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
    audio.playSFX('upgrade');
    upgrade.apply(gameStateRef.current.player, gameStateRef.current.weapons);
    gameStateRef.current.status = GameStatus.PLAYING;
    lastTimeRef.current = performance.now();
    setGameState({ ...gameStateRef.current });
  };

  const onStart = () => {
    audio.playSFX('click');
    startGame();
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
      const oldPos = { ...player.pos };
      updatePlayer(player, keysRef.current, joystick);
      
      if (isMultiplayer && (oldPos.x !== player.pos.x || oldPos.y !== player.pos.y)) {
          socketRef.current?.emit('move', player.pos);
      }

      // 2. Enemy Spawning
      // host handles spawning in multiplayer
      const isHost = !isMultiplayer || Object.keys(state.players)[0] === socketRef.current?.id;
      const difficultyFactor = isMultiplayer ? (1 + (roomUsers - 1) * 0.4) : 1;

      if (isHost) {
        const baseRate = 1000;
        const spawnRate = Math.max(80, (baseRate / (1 + (state.gameTime / 60000) * 0.5)) / difficultyFactor);
        if (Math.random() < (deltaTime / spawnRate)) {
          state.enemies.push(spawnEnemy(state.gameTime, player.pos, difficultyFactor));
        }
      }

      // Wave tracking
      state.wave = Math.floor(state.gameTime / 30000) + 1;

      // 3. Enemy Update
      updateEnemies(state, setShake, () => audio.playSFX('hit', 0.2));

      // 4. Combat / AutoFire
      autoFire(state, () => audio.playSFX('shoot', 0.1));

      // 5. Projectiles Update
      updateProjectiles(state, deltaTime, audio, setShake);

      // 6. Juice and XP
      updateJuice(state);
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
            audio.playSFX('gem', 0.2);
            player.xp += gem.value;
            xpGems.splice(i, 1);

            if (player.xp >= player.maxXp) {
                player.xp -= player.maxXp;
                player.level += 1;
                player.maxXp = Math.floor(10 * Math.pow(1.5, player.level));
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
        if (state.status !== GameStatus.GAME_OVER) {
          audio.playSFX('gameOver');
        }
        state.status = GameStatus.GAME_OVER;
      }

      // Periodically sync to React state for UI (low frequency is fine)
      if (Math.floor(time / 100) !== Math.floor((time - deltaTime) / 100) || state.status !== GameStatus.PLAYING) {
          setGameState({ ...state });
      }
    }

    // Render always with latest ref state
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        setShake(prev => Math.max(0, prev - 0.5));
        drawGame(ctx, state, shake);
      }
    }
    
    requestRef.current = requestAnimationFrame(update);
  }, [joystick, shake]);

  useEffect(() => {
    const handleTouchMoveGlobal = (e: TouchEvent) => {
      if (!joystickCenter) return;
      const touch = e.touches[0];
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const pos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      
      // Dynamic follow logic: Update center if finger moves beyond limit
      const dx = pos.x - joystickCenter.x;
      const dy = pos.y - joystickCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const limit = 50;
      
      let effectiveCenter = joystickCenter;
      if (dist > limit) {
        const angle = Math.atan2(dy, dx);
        effectiveCenter = {
          x: pos.x - Math.cos(angle) * limit,
          y: pos.y - Math.sin(angle) * limit
        };
        setJoystickCenter(effectiveCenter);
      }
      
      handleJoystick(pos, effectiveCenter);
    };

    const handleTouchEndGlobal = () => {
      handleJoystick(null, null);
    };

    if (joystickCenter) {
      window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
      window.addEventListener('touchend', handleTouchEndGlobal);
      window.addEventListener('touchcancel', handleTouchEndGlobal);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMoveGlobal);
      window.removeEventListener('touchend', handleTouchEndGlobal);
      window.removeEventListener('touchcancel', handleTouchEndGlobal);
    };
  }, [joystickCenter]);

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

  const handleJoystick = (pos: Vector | null, center: Vector | null = null) => {
    if (!pos || !center) {
      setJoystick({ x: 0, y: 0 });
      setJoystickCenter(null);
    } else {
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      const limit = 50; // Max visual drag distance
      
      if (mag > 0) {
        // Output normalized vector for the engine
        const normalizedMag = Math.min(mag, limit) / limit;
        setJoystick({
          x: (dx / mag) * normalizedMag,
          y: (dy / mag) * normalizedMag
        });
      } else {
        setJoystick({ x: 0, y: 0 });
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

        {/* Mobile Joystick Area - Dynamic 'Follow the Finger' */}
        {gameState.status === GameStatus.PLAYING && (
          <div 
            className="absolute inset-0 z-50 touch-none pointer-events-auto"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const center = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
              setJoystickCenter(center);
              handleJoystick(center, center);
            }}
          >
             <AnimatePresence>
                {joystickCenter && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute w-24 h-24 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 flex items-center justify-center pointer-events-none shadow-inner"
                    style={{ 
                      left: joystickCenter.x, 
                      top: joystickCenter.y,
                      transform: 'translate(-50%, -50%)' 
                    }}
                  >
                     <motion.div 
                       className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-2xl shadow-blue-500/50 border-2 border-white/20"
                       animate={{ 
                         x: joystick.x * 40, 
                         y: joystick.y * 40 
                       }}
                       transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                     />
                     <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-pulse scale-110" />
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
        )}

      {/* HUD - Portrait Optimized */}
      {(gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.PAUSED || gameState.status === GameStatus.UPGRADING) && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col gap-3"
        >
            {/* Top Bar: Timer & Wave */}
            <div className="flex justify-between items-center px-4 py-2 bg-slate-950/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-lg">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Time</span>
                    <span className="text-lg font-black text-white tabular-nums">
                        {Math.floor(gameState.gameTime / 60000)}:
                        {String(Math.floor((gameState.gameTime % 60000) / 1000)).padStart(2, '0')}
                    </span>
                </div>
                {isMultiplayer && (
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Online</span>
                    <span className="text-xs font-black text-white">{roomUsers} Players</span>
                  </div>
                )}
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
          </motion.div>
        )}

        {/* Lobby Screen */}
        <AnimatePresence>
          {gameState.status === GameStatus.LOBBY && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
               <motion.div
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl w-full max-w-[350px]"
               >
                 <div className="mb-6 text-center">
                   <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Game Lobby</span>
                   <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">多人联机</h2>
                 </div>

                 {roomId ? (
                   <div className="mb-8">
                     <div className="bg-slate-950/50 p-4 rounded-2xl mb-4 border border-white/5">
                       <span className="text-[10px] font-bold text-slate-500 block mb-1">房间代码</span>
                       <span className="text-3xl font-black text-blue-400 tracking-widest">{roomId}</span>
                     </div>
                     <p className="text-xs text-slate-400 font-medium mb-6">
                       当前玩家: <span className="text-white font-black">{roomUsers} / 4</span>
                     </p>

                     {roomUsers > 1 && (
                       <div className="mb-4 py-2 px-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-left">
                         <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">多人难度加成</span>
                         <div className="text-sm font-black text-orange-500">
                           挑战难度: +{Math.round((roomUsers - 1) * 40)}%
                         </div>
                       </div>
                     )}
                     
                     <div className="flex flex-col gap-3">
                       {isHost && (
                         <motion.button 
                           whileTap={{ scale: 0.95 }}
                           onClick={handleStartMultiplayerGame}
                           disabled={roomUsers < 2}
                           className={`w-full py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 ${
                             roomUsers >= 2 
                               ? 'bg-emerald-600 text-white shadow-[0_10px_30px_-5px_rgba(16,185,129,0.4)] border-emerald-800' 
                               : 'bg-slate-800 text-slate-500 border-slate-950 opacity-50 cursor-not-allowed'
                           }`}
                         >
                           <Play size={24} fill="currentColor" /> 开始游戏
                         </motion.button>
                       )}
                       
                       {!isHost && (
                         <div className="py-5 bg-slate-800/50 text-slate-400 font-black rounded-2xl border border-white/5 animate-pulse">
                           等待房主开始...
                         </div>
                       )}

                       <motion.button 
                         whileTap={{ scale: 0.95 }}
                         onClick={handleShare}
                         className="w-full py-4 bg-slate-800 text-white font-black rounded-[2rem] transition-all active:scale-95 flex items-center justify-center gap-2 border-b-4 border-slate-950"
                       >
                         {copied ? <Check size={18} className="text-emerald-500" /> : <Share2 size={18} />}
                         {copied ? '已复制邀请链接' : '分享邀请链接'}
                       </motion.button>

                       <motion.button 
                         whileTap={{ scale: 0.95 }}
                         onClick={resetGame}
                         className="mt-2 text-rose-500 font-black text-xs uppercase tracking-widest hover:text-rose-400 transition-colors"
                       >
                         退出房间
                       </motion.button>
                     </div>
                   </div>
                 ) : (
                   <div className="flex flex-col items-center gap-4">
                     <RotateCcw className="text-blue-500 animate-spin" size={32} />
                     <p className="text-slate-400 font-bold">正在创建/加入房间...</p>
                   </div>
                 )}

                 {errorStatus && (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full px-8"
                    >
                      <div className="bg-rose-500/10 border border-rose-500/50 text-rose-500 p-3 rounded-2xl text-xs font-black">
                        {errorStatus}
                      </div>
                    </motion.div>
                 )}
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* Pause Button */}
        {gameState.status === GameStatus.PLAYING && !isMultiplayer && (
          <button 
            onClick={togglePause}
            className="absolute top-6 right-6 z-[70] p-4 bg-slate-900/50 backdrop-blur-md rounded-full border border-white/10 text-white pointer-events-auto shadow-2xl active:scale-90 transition-transform"
          >
            <Pause size={24} />
          </button>
        )}

        {/* Pause Overlay */}
        <AnimatePresence>
          {gameState.status === GameStatus.PAUSED && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-[80] bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
               <motion.div
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl w-full max-w-[300px]"
               >
                 <h2 className="text-5xl font-black text-white mb-8 italic uppercase tracking-tighter">已 暂 停</h2>
                 <div className="flex flex-col gap-3 w-full">
                   <button 
                     onClick={togglePause}
                     className="w-full py-5 bg-blue-600 text-white font-black text-xl rounded-[2rem] shadow-[0_10px_30px_-5px_rgba(59,130,246,0.5)] transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-blue-800"
                   >
                     <Play size={24} fill="white" /> 继 续
                   </button>
                   <button 
                     onClick={backToMenu}
                     className="w-full py-4 bg-slate-800 text-slate-300 font-bold text-lg rounded-[2rem] transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-slate-950"
                   >
                     <Home size={20} /> 返回主页
                   </button>
                 </div>
               </motion.div>
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

                <div className="mb-2">
                  <motion.div 
                    animate={{ x: [0, 2, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-blue-500 font-black tracking-[0.4em] uppercase text-[10px]"
                  >
                    🚀 Galactic Survivors
                  </motion.div>
                </div>
                <h1 className="text-7xl font-[1000] text-white italic tracking-tighter mb-8 drop-shadow-[0_10px_30px_rgba(59,130,246,0.3)]">
                  CORE<span className="text-blue-500">BLAST</span>
                </h1>
                
                <div className="flex flex-col gap-4 w-full max-w-[300px] mx-auto">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onStart}
                      className="group relative py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl transition-all shadow-[0_20px_40px_-5px_rgba(59,130,246,0.5)] border-b-8 border-blue-800 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3"
                    >
                      <Play size={32} className="fill-white" /> 开始挑战
                    </motion.button>

                    {hasSavedGame && (
                      <motion.button 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={loadGame}
                        className="group relative py-5 bg-emerald-600 text-white rounded-[2.5rem] font-black text-xl transition-all shadow-[0_15px_30px_-5px_rgba(16,185,129,0.3)] border-b-8 border-emerald-800 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3"
                      >
                        <RotateCcw size={28} className="text-white" /> 继续游戏
                      </motion.button>
                    )}

                    <div className="flex gap-3">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startMultiplayer}
                        className="flex-1 py-4 bg-slate-900 border border-white/10 text-white rounded-3xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                         多人对战
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleShare}
                        className="p-4 bg-slate-900 border border-white/10 text-white rounded-3xl transition-all active:scale-95"
                      >
                        <Share2 size={24} />
                      </motion.button>
                    </div>
                </div>

                       <div className="w-full flex gap-2">
                         <input 
                           type="text"
                           placeholder="输入房号加入"
                           value={joinId}
                           onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                           className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500 text-center uppercase"
                         />
                         <button 
                           onClick={() => {
                             if (joinId.length > 0) joinExistingRoom(joinId);
                           }}
                           className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-2xl font-black transition-colors"
                         >
                           加入
                         </button>
                       </div>

                       <button 
                         onClick={handleShare}
                         className="w-full py-3 bg-slate-900 border border-white/10 text-slate-400 font-bold text-sm rounded-[2rem] transition-all active:scale-95 flex items-center justify-center gap-2"
                       >
                         {copied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
                         {copied ? '已复制链接' : '分享链接给好友'}
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

               <div className="flex flex-col gap-3 w-full">
                 <button 
                   onClick={onStart}
                   className="w-full py-6 bg-white text-slate-950 font-black text-xl rounded-[2.5rem] shadow-2xl shadow-white/10 transition-all active:scale-95 flex items-center justify-center gap-3"
                 >
                   <RotateCcw size={24} /> 再次尝试
                 </button>
                 <button 
                    onClick={backToMenu}
                    className="w-full py-4 bg-slate-800 text-white font-black text-lg rounded-[2.5rem] border-b-4 border-slate-950 flex items-center justify-center gap-3"
                  >
                    <Home size={20} /> 返回主页
                  </button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
