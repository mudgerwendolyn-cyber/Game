/**
 * SPDX-License-Identifier: Apache-2.0
 */

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const INITIAL_PLAYER_STATS = {
  hp: 100,
  maxHp: 100,
  speed: 2.5,
  xp: 0,
  level: 1,
  maxXp: 50,
  attackPower: 1,
  attackSpeed: 1,
  critRate: 0.05,
  critDamage: 1.5,
  lifesteal: 0,
  pierce: 0,
  multiShot: 1,
  knockback: 0,
  radius: 15,
  killCount: 0
};

export const STAT_CAPS = {
  attackSpeed: 3.0,
  multiShot: 8,
  critRate: 0.6
};

export const WEAPON_TYPES = {
  PISTOL: {
    name: '基础手枪',
    type: 'projectile' as const,
    damage: 10,
    cooldown: 800,
    range: 400,
    projectileSpeed: 7,
    color: '#fff'
  },
  SHOTGUN: {
    name: '霰弹枪',
    type: 'projectile' as const,
    damage: 15,
    cooldown: 1200,
    range: 250,
    projectileSpeed: 6,
    color: '#fbbf24'
  },
  SMG: {
    name: '冲锋枪',
    type: 'projectile' as const,
    damage: 5,
    cooldown: 250,
    range: 350,
    projectileSpeed: 9,
    color: '#60a5fa'
  }
};

export const ENEMY_TEMPLATES = {
  BASIC: {
    hp: 30,
    speed: 1.5,
    damage: 5,
    radius: 12,
    color: '#ef4444'
  },
  FAST: {
    hp: 20,
    speed: 3.0,
    damage: 4,
    radius: 9,
    color: '#f97316'
  },
  ELITE: {
    hp: 150,
    speed: 1.2,
    damage: 15,
    radius: 20,
    color: '#fbbf24'
  }
};
