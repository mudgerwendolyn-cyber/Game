/**
 * SPDX-License-Identifier: Apache-2.0
 */

export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;

export const INITIAL_PLAYER_STATS = {
  hp: 80,
  maxHp: 80,
  speed: 2.2,
  xp: 0,
  level: 1,
  maxXp: 15,
  attackPower: 0.8, // Used as multiplier
  attackSpeed: 0.8,
  critRate: 0.03,
  critDamage: 1.5,
  lifesteal: 0,
  pierce: 0,
  multiShot: 1,
  knockback: 0,
  radius: 8,
  killCount: 0
};

export const STAT_CAPS = {
  attackSpeed: 2.5,
  multiShot: 6,
  critRate: 0.5,
  lifesteal: 0.05,
  pierce: 2
};

export const WEAPON_TYPES = {
  PISTOL: {
    name: '基础手枪',
    type: 'projectile' as const,
    damage: 10, // 0.8 * 10 = 8 dmg
    cooldown: 400,
    range: 600,
    projectileSpeed: 10,
    color: '#fff'
  },
  SHOTGUN: {
    name: '霰弹枪',
    type: 'projectile' as const,
    damage: 12,
    cooldown: 1200,
    range: 250,
    projectileSpeed: 6,
    color: '#fbbf24'
  },
  SMG: {
    name: '冲锋枪',
    type: 'projectile' as const,
    damage: 4,
    cooldown: 250,
    range: 350,
    projectileSpeed: 9,
    color: '#60a5fa'
  }
};

export const ENEMY_TEMPLATES = {
  BASIC: {
    hp: 35,
    speed: 1.6,
    damage: 6,
    radius: 12,
    color: '#ef4444',
    xp: 1
  },
  FAST: {
    hp: 25,
    speed: 3.2,
    damage: 5,
    radius: 9,
    color: '#f97316',
    xp: 1
  },
  TANK: {
    hp: 120,
    speed: 1.0,
    damage: 10,
    radius: 18,
    color: '#94a3b8',
    xp: 5
  },
  ELITE: {
    hp: 220,
    speed: 1.4,
    damage: 18,
    radius: 20,
    color: '#fbbf24',
    xp: 8
  },
  BOMBER: {
    hp: 40,
    speed: 1.8,
    damage: 12,
    radius: 14,
    color: '#a855f7',
    xp: 3
  }
};
