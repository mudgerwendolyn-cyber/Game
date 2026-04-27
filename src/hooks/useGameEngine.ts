/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Hero, Monster, GameState, GAME_CONSTANTS, calculateHeroStats, calculateMonsterStats, BossAbility } from '../types';
import { generateMonsterDetails, generateBossDetails } from '../services/ai';

const HERO_NAMES_BY_LEVEL: Record<number, string> = {
  1: '新手战士',
  2: '资深步兵',
  3: '护甲卫兵',
  4: '尖峰勇士',
  5: '坚毅骑士',
  6: '圣殿守护者',
  7: '狂暴千夫长',
  8: '龙血角斗士',
  9: '绝影刺客',
  10: '神圣大领主',
};

const getHeroName = (level: number) => HERO_NAMES_BY_LEVEL[level] || `神级统帅 Lv.${level}`;

export const useGameEngine = () => {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem('merge_hero_save');
    const initialState: GameState = {
      gold: 500,
      highestLevel: 1,
      grid: new Array(GAME_CONSTANTS.GRID_SIZE).fill(null),
      monstersDefeated: 0,
      currentMonster: null,
      heroInCombat: null,
      baseHp: 1000,
      maxBaseHp: 1000,
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialState,
          ...parsed,
          baseHp: parsed.baseHp ?? 1000,
          maxBaseHp: parsed.maxBaseHp ?? 1000,
        };
      } catch (e) {
        return initialState;
      }
    }
    return initialState;
  });

  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [spawnTimer, setSpawnTimer] = useState<number | null>(null);
  const battleInterval = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  const [isPaused, setIsPaused] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('merge_hero_save', JSON.stringify(state));
  }, [state]);

  const resetGame = useCallback(() => {
    localStorage.removeItem('merge_hero_save');
    setState({
      gold: 500,
      highestLevel: 1,
      grid: new Array(GAME_CONSTANTS.GRID_SIZE).fill(null),
      monstersDefeated: 0,
      currentMonster: null,
      heroInCombat: null,
      baseHp: 1000,
      maxBaseHp: 1000,
    });
    setSpawnTimer(null);
    setIsPaused(false);
  }, []);

  const spawnMonster = useCallback(() => {
    const stage = state.monstersDefeated + 1;
    const isBossStage = stage % 5 === 0;
    
    let newMonster: Monster;

    if (isBossStage) {
      const stats = calculateMonsterStats(stage + 1); // Bosses are harder
      newMonster = {
        id: Math.random().toString(36).substr(2, 9),
        level: stage,
        rewardGold: stats.gold * 3, // Bosses give 3x gold
        isBoss: true,
        name: `暗黑骨龙 Lv.${stage}`,
        description: "支配黑暗的远古巨兽。",
        battleQuotes: ["在绝望中颤抖吧！", "死亡即是你的归宿。", "感受这深渊的温度！", "化烬吧。"],
        ability: BossAbility.ENRAGE,
        ...stats,
        hp: stats.hp * 2, // Bosses have 2x HP
        maxHp: stats.hp * 2,
        attack: Math.floor(stats.attack * 1.5),
      };
    } else {
      const stats = calculateMonsterStats(stage);
      newMonster = {
        id: Math.random().toString(36).substr(2, 9),
        level: stage,
        rewardGold: stats.gold,
        name: `深渊魔兵 Lv.${stage}`,
        description: "黑暗深渊中的喽啰。",
        battleQuotes: ["嘶嘶...", "为了主人！", "撕碎你！"],
        ...stats,
        maxHp: stats.hp,
      };
    }

    setState(prev => ({ ...prev, currentMonster: newMonster }));
    setSpawnTimer(null);
  }, [state.monstersDefeated]);

  // Handle spawn timing
  useEffect(() => {
    if (!state.currentMonster && spawnTimer === null && !isPaused) {
      setSpawnTimer(3); // 3 seconds countdown
    }
  }, [state.currentMonster, spawnTimer, isPaused]);

  useEffect(() => {
    if (spawnTimer === null || isPaused) return;

    if (spawnTimer > 0) {
      const timer = setTimeout(() => {
        setSpawnTimer(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (spawnTimer === 0) {
      setSpawnTimer(-1);
      spawnMonster();
    }
  }, [spawnTimer, spawnMonster, isPaused]);

  const spawnHero = useCallback((level?: number, slotIdx?: number) => {
    // Dynamic spawn level and cost
    const spawnLevel = level ?? Math.max(1, state.highestLevel - 3);
    const cost = Math.floor(GAME_CONSTANTS.HERO_BUY_COST * Math.pow(1.6, spawnLevel - 1));
    
    if (state.gold < cost && slotIdx === undefined) return;

    let targetIdx = slotIdx;
    if (targetIdx === undefined) {
      targetIdx = state.grid.findIndex(slot => slot === null);
    }
    
    if (targetIdx === -1) return;

    const stats = calculateHeroStats(spawnLevel);
    const newHero: Hero = {
      id: Math.random().toString(36).substr(2, 9),
      name: getHeroName(spawnLevel),
      level: spawnLevel,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      skills: [],
      rarity: spawnLevel > 10 ? 'Legendary' : spawnLevel > 5 ? 'Epic' : spawnLevel > 2 ? 'Rare' : 'Common',
    };

    setState(prev => {
      const newGrid = [...prev.grid];
      newGrid[targetIdx!] = newHero;
      return {
        ...prev,
        grid: newGrid,
        gold: slotIdx === undefined ? prev.gold - cost : prev.gold
      };
    });
  }, [state.gold, state.grid, state.highestLevel]);

  const mergeHeroes = useCallback((idx1: number, idx2: number) => {
    const hero1 = state.grid[idx1];
    const hero2 = state.grid[idx2];

    if (!hero1 || !hero2 || hero1.id === hero2.id) return;
    if (hero1.level !== hero2.level) return;

    const newLevel = hero1.level + 1;
    const stats = calculateHeroStats(newLevel);

    const mergedHero: Hero = {
      id: Math.random().toString(36).substr(2, 9),
      level: newLevel,
      name: getHeroName(newLevel),
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      skills: [],
      rarity: newLevel > 10 ? 'Legendary' : newLevel > 5 ? 'Epic' : newLevel > 2 ? 'Rare' : 'Common',
    };

    setState(prev => {
      const newGrid = [...prev.grid];
      newGrid[idx1] = null;
      newGrid[idx2] = mergedHero;
      // When merging, heroes are fully healed
      // Also check if we should clear hero in combat to prevent weird states
      return {
        ...prev,
        grid: newGrid,
        highestLevel: Math.max(prev.highestLevel, newLevel),
        heroInCombat: prev.heroInCombat && (prev.heroInCombat.id === hero1.id || prev.heroInCombat.id === hero2.id) ? null : prev.heroInCombat
      };
    });
  }, [state.grid]);

  // COMBAT LOGIC
  const combatStep = useCallback(() => {
    setState(prev => {
      if (!prev.currentMonster || prev.baseHp <= 0) return prev;
      
      const monster = { ...prev.currentMonster };

      // Passive Base Heal
      let newBaseHp = prev.baseHp;
      if (newBaseHp < (prev.maxBaseHp ?? 1000)) {
         newBaseHp = Math.min(prev.maxBaseHp ?? 1000, newBaseHp + 5); 
      }

      // Base Passive Attack
      const baseAttackAmount = Math.floor(GAME_CONSTANTS.BASE_HERO_ATTACK * Math.pow(1.15, prev.highestLevel));
      monster.hp -= baseAttackAmount;

      if (monster.hp <= 0) {
        return {
          ...prev,
          gold: prev.gold + monster.rewardGold,
          monstersDefeated: prev.monstersDefeated + 1,
          currentMonster: null,
          baseHp: newBaseHp,
        };
      }
      
      let currentHero = prev.heroInCombat;
      if (!currentHero || currentHero.hp <= 0) {
        // Find next living hero
        const pool = prev.grid.filter((h): h is Hero => h !== null && h.hp > 0);
        if (pool.length > 0) {
           currentHero = { ...pool.sort((a, b) => b.level - a.level)[0] };
        } else {
           currentHero = null;
        }
      }

      // Passive hero heal for everyone on grid NOT in combat
      const newGrid = prev.grid.map(hero => {
        if (!hero || hero.hp <= 0) return hero;
        if (currentHero && hero.id === currentHero.id) return hero;
        if (hero.hp < hero.maxHp) {
           return { ...hero, hp: Math.min(hero.maxHp, hero.hp + Math.max(1, Math.floor(hero.maxHp * 0.1))) }; // 10% heal per tick
        }
        return hero;
      });

      // BOSS ABILITY: HEAL
      if (monster.isBoss && monster.ability === BossAbility.HEAL) {
        monster.hp = Math.min(monster.maxHp, monster.hp + Math.floor(monster.maxHp * 0.02));
      }

      if (currentHero) {
          // Hero attacks
          let damageToMonster = currentHero.attack;
          
          // BOSS ABILITY: ARMOR
          if (monster.isBoss && monster.ability === BossAbility.ARMOR) {
            damageToMonster = Math.floor(damageToMonster * 0.7);
          }

          monster.hp -= damageToMonster;
          
          // Monster attacks back if alive
          if (monster.hp > 0) {
            let monsterDamage = monster.attack;
            
            // BOSS ABILITY: ENRAGE
            if (monster.isBoss && monster.ability === BossAbility.ENRAGE && (monster.hp / monster.maxHp) < 0.4) {
              monsterDamage = Math.floor(monsterDamage * 1.5);
            }

            currentHero.hp -= monsterDamage;

            // BOSS ABILITY: VAMPIRISM
            if (monster.isBoss && monster.ability === BossAbility.VAMPIRISM) {
              monster.hp = Math.min(monster.maxHp, monster.hp + Math.floor(monsterDamage * 0.2));
            }
          }

          if (monster.hp <= 0) {
             const idx = newGrid.findIndex(h => h && h.id === currentHero!.id);
             if (idx !== -1) {
                newGrid[idx] = currentHero;
             }
            return {
              ...prev,
              grid: newGrid,
              gold: prev.gold + monster.rewardGold,
              monstersDefeated: prev.monstersDefeated + 1,
              currentMonster: null,
              heroInCombat: null,
              baseHp: newBaseHp,
            };
          }

          if (currentHero.hp <= 0) {
            const idx = newGrid.findIndex(h => h && h.id === currentHero!.id);
            if (idx !== -1) {
              newGrid[idx] = null; // Faint, not delete
            }
            
            return {
              ...prev,
              grid: newGrid,
              currentMonster: monster,
              heroInCombat: null,
              baseHp: newBaseHp,
            };
          }
          
          return {
            ...prev,
            grid: newGrid,
            currentMonster: monster,
            heroInCombat: currentHero,
            baseHp: newBaseHp,
          };
      } else {
          // Tower Defense Mode: Monster attacks Base
          let monsterDamage = monster.attack;
          if (monster.isBoss && monster.ability === BossAbility.ENRAGE && (monster.hp / monster.maxHp) < 0.4) {
            monsterDamage = Math.floor(monsterDamage * 1.5);
          }
          if (monster.isBoss && monster.ability === BossAbility.VAMPIRISM) {
             monster.hp = Math.min(monster.maxHp, monster.hp + Math.floor(monsterDamage * 0.2));
          }
          
          newBaseHp = Math.max(0, newBaseHp - monsterDamage);

          if (newBaseHp <= 0) {
             return {
                ...prev,
                grid: newGrid,
                currentMonster: monster,
                heroInCombat: null,
                baseHp: 0
             };
          }

          return {
             ...prev,
             grid: newGrid,
             currentMonster: monster,
             heroInCombat: null,
             baseHp: newBaseHp
          };
      }
    });
  }, []);

  useEffect(() => {
    if (state.currentMonster && !isPaused && state.baseHp > 0) {
      battleInterval.current = setInterval(combatStep, 800); // Slower combat
    }
    return () => {
      if (battleInterval.current) clearInterval(battleInterval.current);
    };
  }, [state.currentMonster, combatStep, isPaused, state.baseHp]);

  const moveHero = (fromIdx: number, toIdx: number) => {
    setState(prev => {
      const newGrid = [...prev.grid];
      const temp = newGrid[toIdx];
      newGrid[toIdx] = newGrid[fromIdx];
      newGrid[fromIdx] = temp;
      return { ...prev, grid: newGrid };
    });
  };

  const spawnLevel = Math.max(1, state.highestLevel - 3);
  const buyCost = Math.floor(GAME_CONSTANTS.HERO_BUY_COST * Math.pow(1.6, spawnLevel - 1));

  return {
    state,
    spawnHero,
    mergeHeroes,
    moveHero,
    combatLogs,
    spawnTimer,
    buyCost,
    spawnLevel,
    isPaused,
    setIsPaused,
    resetGame
  };
};
