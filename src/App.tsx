/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FC, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { useGameEngine } from './hooks/useGameEngine';
import { Hero, Monster, GAME_CONSTANTS, BossAbility } from './types';
import { 
  Sword, 
  Shield, 
  Coins, 
  Trophy, 
  Plus, 
  Zap, 
  ChevronUp,
  Heart,
  Play,
  Pause,
  RotateCcw,
  Home
} from 'lucide-react';

const RARITY_COLORS = {
  Common: 'from-slate-400 to-slate-500',
  Rare: 'from-blue-400 to-blue-500',
  Epic: 'from-purple-500 to-purple-600',
  Legendary: 'from-yellow-400 to-orange-500',
};

interface HeroCardProps {
  hero: Hero | null;
  index: number;
  onDragStart: (idx: number) => void;
  onDrop: (idx: number) => void;
  onClick: (idx: number) => void;
  isSelected?: boolean;
  disabled: boolean;
  isInCombat?: boolean;
}

const RARITY_LABELS = {
  Common: '普通',
  Rare: '稀有',
  Epic: '史诗',
  Legendary: '传奇',
};

const BOSS_ABILITY_LABELS = {
  [BossAbility.ARMOR]: '护甲 (减伤)',
  [BossAbility.HEAL]: '自愈 (回血)',
  [BossAbility.ENRAGE]: '狂暴 (残血加攻)',
  [BossAbility.VAMPIRISM]: '汲取 (吸血)',
};

const HeroCard: FC<HeroCardProps> = ({ hero, index, onDragStart, onDrop, onClick, isSelected, disabled, isInCombat }) => {
  return (
    <div 
      className={`relative aspect-square rounded-xl border-2 border-dashed ${isInCombat ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : isSelected ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'border-slate-700'} bg-slate-800/50 flex items-center justify-center p-1 overflow-hidden transition-all duration-300 ${hero ? 'border-solid cursor-pointer active:scale-95 hover:scale-105' : 'cursor-pointer'} ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      onDragOver={(e) => !disabled && e.preventDefault()}
      onDragStart={() => !disabled && hero && onDragStart(index)}
      onDrop={() => !disabled && onDrop(index)}
      onClick={() => !disabled && onClick(index)}
      draggable={!disabled && !!hero}
    >
      {hero && (
        <motion.div 
          layoutId={hero.id}
          className={`w-full h-full bg-gradient-to-br ${RARITY_COLORS[hero.rarity]} rounded-lg shadow-lg flex flex-col items-center justify-center text-white relative ${isInCombat ? 'ring-2 ring-amber-400' : ''}`}
        >
          {isInCombat && (
             <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 animate-pulse z-30 shadow-md">
               <Sword size={10} className="text-white" />
             </div>
          )}
          <div className="text-2xl mb-0.5 transition-transform duration-300">
            {hero.level > 10 ? '👑' : hero.level > 5 ? '⚔️' : hero.level > 2 ? '🛡️' : '👤'}
          </div>
          <div className="text-[7.5px] sm:text-[9px] font-bold leading-tight w-full text-center px-0.5 drop-shadow-md whitespace-normal break-words">
            {hero.name.replace(/\s*Lv\.\d+/g, '')} <span className="opacity-90 whitespace-nowrap">Lv.{hero.level}</span>
          </div>
          <div className="text-[6.5px] sm:text-[7px] opacity-70 font-bold uppercase mt-0.5">{RARITY_LABELS[hero.rarity]}</div>
          
          {/* Stats Overlay */}
          <div className="absolute bottom-1.5 right-1 left-1 flex justify-between px-1 opacity-0 hover:opacity-100 transition-opacity z-20">
            <div className="flex items-center gap-0.5 text-[8px] drop-shadow-md font-bold"><Sword size={8}/>{hero.attack}</div>
            <div className="flex items-center gap-0.5 text-[8px] drop-shadow-md font-bold"><Heart size={10} className="text-emerald-400"/>{hero.hp}</div>
          </div>
          
          {/* HP Bar */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-black/40 overflow-hidden rounded-b-lg">
             <div 
                className="h-full bg-emerald-400 transition-all duration-300" 
                style={{ width: `${(hero.hp / hero.maxHp) * 100}%` }}
             />
          </div>
        </motion.div>
      )}
      {!hero && <div className="text-slate-700 opacity-20"><Plus size={24}/></div>}
    </div>
  );
};

const DamageNumber: FC<{ value: number, isCritical?: boolean }> = ({ value, isCritical }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.5 }}
    animate={{ opacity: 0, y: -100, scale: 1.5 }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className={`absolute z-[100] font-black pointer-events-none select-none drop-shadow-lg ${isCritical ? 'text-yellow-400 text-3xl italic' : 'text-red-500 text-xl'}`}
    style={{ left: `${40 + Math.random() * 20}%`, top: '40%' }}
  >
    {value}
  </motion.div>
);

export default function App() {
  const { state, spawnHero, mergeHeroes, moveHero, spawnTimer, buyCost, spawnLevel, isPaused, setIsPaused, resetGame } = useGameEngine();
  const [currentView, setCurrentView] = useState<'menu' | 'game'>('menu');
  const [confirmReset, setConfirmReset] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [damageNumbers, setDamageNumbers] = useState<{ id: number, value: number, isCritical?: boolean }[]>([]);
  const prevMonsterHp = useRef(state.currentMonster?.hp || 0);

  // Trigger damage number when monster HP changes
  useEffect(() => {
    if (state.currentMonster && state.currentMonster.hp < prevMonsterHp.current) {
      const damage = prevMonsterHp.current - state.currentMonster.hp;
      if (damage > 0) {
        const id = Date.now();
        setDamageNumbers(prev => [...prev.slice(-4), { id, value: damage }]);
        setTimeout(() => setDamageNumbers(prev => prev.filter(n => n.id !== id)), 1000);
      }
    }
    prevMonsterHp.current = state.currentMonster?.hp || 0;
  }, [state.currentMonster?.hp]);

  const handleDrop = (toIdx: number) => {
    if (draggedIdx === null) return;
    if (draggedIdx === toIdx) {
      setDraggedIdx(null);
      return;
    }
    
    const fromHero = state.grid[draggedIdx];
    const toHero = state.grid[toIdx];

    if (fromHero && toHero && fromHero.level === toHero.level && draggedIdx !== toIdx) {
      mergeHeroes(draggedIdx, toIdx);
    } else {
      moveHero(draggedIdx, toIdx);
    }
    setDraggedIdx(null);
  };

  const handleCardClick = (idx: number) => {
    if (draggedIdx === null) {
      // selecting first card
      if (state.grid[idx]) {
        setDraggedIdx(idx);
      }
    } else {
      // dropping/merging
      handleDrop(idx);
    }
  };

  if (currentView === 'menu') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="z-10 flex flex-col items-center gap-8 mix-blend-lighten max-w-sm w-full">
          <div className="text-8xl animate-bounce mb-4 filter drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">🐉</div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 tracking-tighter">Merge Heroes</h1>
          <p className="text-slate-400 font-medium">合成高阶英雄，击溃无尽的深渊怪物！</p>
          
          <div className="w-full flex justify-between bg-slate-900/80 p-4 border border-slate-800 rounded-2xl mb-4 text-left">
             <div>
               <div className="text-[10px] text-slate-500 font-bold uppercase">最高纪录关卡</div>
               <div className="text-xl font-black text-purple-400 tabular-nums">STAGE {state.monstersDefeated + 1}</div>
             </div>
             <div className="flex flex-col items-end">
               <div className="text-[10px] text-slate-500 font-bold uppercase">最高英雄等级</div>
               <div className="text-xl font-black text-emerald-400 tabular-nums">Lv.{state.highestLevel}</div>
             </div>
          </div>

          <button 
             onClick={() => {
                if (state.monstersDefeated === 0 && state.highestLevel === 1 && state.grid.every(x => x===null)) {
                   resetGame(); // Ensure clean slate if nothing happened
                }
                setConfirmReset(false);
                setIsPaused(false);
                setCurrentView('game');
             }} 
             className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
             <Play className="fill-white" size={20} /> 继续游戏
          </button>
          
          {confirmReset ? (
            <div className="w-full flex flex-col gap-2">
              <div className="text-sm text-red-400 mb-2 font-bold">确认要清空所有进度和金币吗？</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setConfirmReset(false)} 
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-base rounded-xl transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    resetGame();
                    setConfirmReset(false);
                    setCurrentView('game');
                  }} 
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-base rounded-xl transition-colors"
                >
                  确认重置
                </button>
              </div>
            </div>
          ) : (
            <button 
               onClick={() => setConfirmReset(true)} 
               className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-red-400 font-bold text-base rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
               <RotateCcw size={18} /> 重新开始
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state.baseHp <= 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute inset-0 bg-red-950/20 pointer-events-none" />
        <h1 className="text-6xl font-black text-red-500 mb-4 animate-bounce">GAME OVER</h1>
        <p className="text-xl text-slate-400 mb-8 font-medium">城堡防线已被冲破...</p>
        
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-red-900/50 mb-8 min-w-[280px]">
          <div className="text-sm text-slate-500 font-bold mb-2 uppercase tracking-widest">最终成绩</div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300">抵御波数</span>
            <span className="text-2xl font-black text-purple-400">{state.monstersDefeated}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">最高英雄等级</span>
            <span className="text-2xl font-black text-emerald-400">Lv.{state.highestLevel}</span>
          </div>
        </div>

        <button 
           onClick={() => {
              resetGame();
              setCurrentView('game');
           }} 
           className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
           <RotateCcw size={20} /> 重新挑战
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30 overflow-hidden flex flex-col">
      {/* Status Bar */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-2 sm:p-4 pt-[max(env(safe-area-inset-top,0px),0.5rem)] sticky top-0 z-50 flex justify-between items-center px-2 sm:px-4 md:px-6">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-lg">
            <Coins className="text-yellow-500" size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium leading-none">金币</span>
            <span className="font-bold text-base sm:text-lg tabular-nums leading-tight">{state.gold}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-end mr-1 sm:mr-2">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">城堡护甲</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Heart size={12} className="text-rose-500 fill-rose-500/20" />
              <span className="font-black text-sm sm:text-base text-rose-400 leading-tight">{state.baseHp}</span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 sm:p-1 mr-1 sm:mr-2 border border-slate-700">
            <button 
              onClick={() => setIsPaused(!isPaused)} 
              className={`p-1.5 rounded-md transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-slate-700 text-slate-300'}`}
              title={isPaused ? "恢复" : "暂停"}
            >
              {isPaused ? <Play size={14} className="fill-current" /> : <Pause size={14} className="fill-current" />}
            </button>
            <button 
              onClick={() => {
                 setIsPaused(true); // Auto pause when leaving
                 setCurrentView('menu');
              }} 
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-md transition-colors"
              title="返回菜单"
            >
              <Home size={14} />
            </button>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-tight leading-none">关卡</span>
            <span className="font-bold text-base sm:text-lg text-purple-400 leading-tight">{state.monstersDefeated + 1}</span>
          </div>
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-tight leading-none">最高等级</span>
            <span className="font-bold text-base sm:text-lg text-emerald-400 leading-tight">{state.highestLevel}</span>
          </div>
        </div>
      </div>

      {/* Battle Area */}
      <div className="flex-1 min-h-[30vh] sm:min-h-[35vh] relative p-4 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 overflow-visible">
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        {/* Paused Overlay */}
        <AnimatePresence>
          {isPaused && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="absolute inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
            >
               <div className="text-3xl font-black text-amber-500 tracking-[0.5em] uppercase drop-shadow-2xl">已暂停</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Damage Numbers */}
        <AnimatePresence>
          {damageNumbers.map(n => (
            <DamageNumber key={n.id} value={n.value} />
          ))}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {state.currentMonster ? (
            <motion.div 
              key={state.currentMonster.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={damageNumbers.length > 0 ? {
                opacity: 1, 
                y: 0, 
                scale: 1,
                x: [0, -5, 5, -5, 0], // Shake
              } : { 
                opacity: 1, 
                y: 0, 
                scale: 1,
                x: 0
              }}
              transition={damageNumbers.length > 0 ? {
                x: { duration: 0.2, repeat: 0 }
              } : {}}
              exit={{ opacity: 0, scale: 1.2, filter: 'brightness(2)' }}
              className="flex flex-col items-center gap-4 relative"
            >
              {/* Monster Speech Bubble */}
              <AnimatePresence>
                {state.heroInCombat && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-4 py-2 rounded-2xl text-[10px] font-bold shadow-2xl min-w-[80px] text-center"
                  >
                    {state.currentMonster.battleQuotes[Math.floor(Date.now() / 3000) % state.currentMonster.battleQuotes.length]}
                    <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <motion.div 
                  className={`text-8xl drop-shadow-[0_0_25px_rgba(239,68,68,0.5)] cursor-default ${state.currentMonster.isBoss ? 'scale-125' : ''}`}
                  animate={state.currentMonster.isBoss ? { 
                    y: [0, -15, 0],
                    scale: [1.2, 1.3, 1.2],
                    filter: ['hue-rotate(0deg)', 'hue-rotate(45deg)', 'hue-rotate(0deg)']
                  } : { 
                    y: [0, -10, 0],
                    rotate: [-2, 2, -2]
                  }}
                  transition={{ repeat: Infinity, duration: state.currentMonster.isBoss ? 2 : 4 }}
                >
                  {state.currentMonster.isBoss ? '🐉' : '👾'}
                </motion.div>
                <div className={`absolute -top-6 -right-6 ${state.currentMonster.isBoss ? 'bg-orange-600 scale-125' : 'bg-red-600'} text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border-2 border-white/20`}>
                  {state.currentMonster.isBoss ? 'BOSS' : `等级.${state.currentMonster.level}`}
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-1">
                <h2 className={`text-xl font-bold uppercase tracking-widest ${state.currentMonster.isBoss ? 'text-orange-500 animate-pulse' : 'text-red-400'}`}>
                  {state.currentMonster.name}
                </h2>
                
                {state.currentMonster.isBoss && state.currentMonster.ability && (
                   <div className="bg-orange-950/50 border border-orange-500/50 px-3 py-1 rounded-full mb-1 flex items-center gap-2">
                     <Shield size={12} className="text-orange-400" />
                     <span className="text-[10px] font-bold text-orange-200 uppercase tracking-tighter">
                       能力: {BOSS_ABILITY_LABELS[state.currentMonster.ability] || state.currentMonster.ability}
                     </span>
                   </div>
                )}

                <div className={`w-64 h-3 bg-slate-800 rounded-full border border-slate-700 overflow-hidden shadow-inner ${state.currentMonster.isBoss ? 'border-orange-500/30' : ''}`}>
                  <motion.div 
                    className={`h-full bg-gradient-to-r ${state.currentMonster.isBoss ? 'from-orange-500 to-red-600' : 'from-red-500 to-red-600'}`}
                    initial={{ width: "100%" }}
                    animate={{ width: `${(state.currentMonster.hp / state.currentMonster.maxHp) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">
                  血量: {state.currentMonster.hp} / {state.currentMonster.maxHp}
                </div>
              </div>
            </motion.div>
          ) : spawnTimer !== null && (
            <motion.div 
              key="countdown"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              <div className="text-slate-500 font-black uppercase tracking-widest text-xs mb-2">下一波怪兽即将到来</div>
              <div className="relative flex items-center justify-center">
                 <motion.div 
                   animate={{ scale: [1, 1.2, 1], rotate: 360 }}
                   transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                   className="w-24 h-24 rounded-full border-4 border-dashed border-purple-500/30"
                 />
                 <div className="absolute text-5xl font-black text-purple-400 tabular-nums">
                   {spawnTimer}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-12 flex items-center justify-center">
            {state.heroInCombat && (
               <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  x: damageNumbers.length > 0 ? [0, 8, 0] : 0,
                  rotate: damageNumbers.length > 0 ? [0, -5, 0] : 0
                }}
                className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-2xl shadow-xl"
               >
                 <span className="text-2xl">⚔️</span>
                 <div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">正在战斗</div>
                   <div className="text-sm font-bold truncate max-w-[120px]">
                     {state.heroInCombat.name.replace(/\s*Lv\.\d+/g, '')} Lv.{state.heroInCombat.level}
                   </div>
                 </div>
                 <div className="ml-4 flex flex-col items-end">
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold leading-none mb-1">
                        <Heart size={10} /> {state.heroInCombat.hp}
                    </div>
                    <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${(state.heroInCombat.hp / state.heroInCombat.maxHp) * 100}%` }} 
                        />
                    </div>
                 </div>
               </motion.div>
            )}
        </div>
      </div>

      {/* Merge Grid Area */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 sm:p-6 pb-[max(env(safe-area-inset-bottom,0px),1rem)] rounded-t-[2rem] sm:rounded-t-[2.5rem] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.5)] z-10 relative">
        <div className="max-w-md mx-auto flex flex-col gap-4 sm:gap-6">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {state.grid.map((hero, idx) => (
              <HeroCard 
                key={idx} 
                index={idx}
                hero={hero} 
                onDragStart={setDraggedIdx}
                onDrop={handleDrop}
                onClick={handleCardClick}
                isSelected={draggedIdx === idx}
                disabled={false}
                isInCombat={!!hero && !!state.heroInCombat && hero.id === state.heroInCombat.id}
              />
            ))}
          </div>

          <button 
            onClick={() => spawnHero()}
            disabled={state.gold < buyCost || state.grid.every(s => s !== null)}
            className="w-full py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3 group overflow-hidden relative"
          >
            <Zap className="text-yellow-400 fill-yellow-400 w-5 h-5 sm:w-6 sm:h-6" />
            召唤英雄 (Lv.{spawnLevel})
            <span className="flex items-center gap-1 text-xs sm:text-sm bg-black/20 px-2 sm:px-3 py-1 rounded-full text-yellow-300">
              <Coins size={12} className="sm:hidden" />
              <Coins size={14} className="hidden sm:block" /> {buyCost}
            </span>
          </button>
          <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-60 text-center mb-1">
            <span className="hidden sm:inline">拖拽并</span>点击或拖拽合并相同等级的英雄
          </p>
        </div>
      </div>

      {/* Footer Instructions (Mobile optimized) */}
      <div className="bg-slate-950 p-2 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center hidden">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-50">
          拖拽并合并相同等级的英雄来进化
        </p>
      </div>
    </div>
  );
}

