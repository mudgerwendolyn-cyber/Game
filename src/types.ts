/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SkillType {
  SINGLE_DAMAGE = 'SINGLE_DAMAGE',
  AOE_DAMAGE = 'AOE_DAMAGE',
  CRIT = 'CRIT',
  HEAL = 'HEAL',
}

export interface Skill {
  name: string;
  type: SkillType;
  description: string;
  value: number; // Percentage or flat value depending on type
}

export interface Hero {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  skills: Skill[];
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  portrait?: string;
}

export enum BossAbility {
  ARMOR = 'ARMOR', // Reduces damage taken
  HEAL = 'HEAL',   // Regenerates HP over time
  ENRAGE = 'ENRAGE', // Attack increases as HP drops
  VAMPIRISM = 'VAMPIRISM', // Heals on attack
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  rewardGold: number;
  description: string;
  battleQuotes: string[];
  isBoss?: boolean;
  ability?: BossAbility;
}

export interface GameState {
  gold: number;
  highestLevel: number;
  grid: (Hero | null)[]; // 4x4 grid = 16 slots
  monstersDefeated: number;
  currentMonster: Monster | null;
  heroInCombat: Hero | null;
  baseHp: number;
  maxBaseHp: number;
}

// Formulas & Constants
export const GAME_CONSTANTS = {
  GRID_SIZE: 16,
  BASE_HERO_HP: 100,
  BASE_HERO_ATTACK: 15,
  BASE_MONSTER_HP: 80,
  BASE_MONSTER_ATTACK: 10,
  BASE_COIN_REWARD: 20,
  HERO_BUY_COST: 50,
  UPGRADE_COST_EXPONENT: 1.5,
  LEVEL_GROWTH_FACTOR: 0.1, // 10% per level
};

export const calculateHeroStats = (level: number) => {
  // Multiply stats by >2 per level so merging (sacrificing 2 to get 1) is a buff, not a nerf
  const multi = Math.pow(2.1, level - 1);
  return {
    hp: Math.floor(GAME_CONSTANTS.BASE_HERO_HP * multi),
    attack: Math.floor(GAME_CONSTANTS.BASE_HERO_ATTACK * multi),
  };
};

export const calculateMonsterStats = (stage: number) => {
  // Smooth scaling for TD balance
  const multi = Math.pow(1.15, stage - 1);
  const goldMulti = Math.pow(1.3, stage - 1);
  return {
    hp: Math.floor(GAME_CONSTANTS.BASE_MONSTER_HP * multi),
    attack: Math.floor((GAME_CONSTANTS.BASE_MONSTER_ATTACK + stage) * multi * 0.9),
    gold: Math.floor(GAME_CONSTANTS.BASE_COIN_REWARD * goldMulti * (0.8 + Math.random() * 0.4)),
  };
};
