/**
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameStatus {
  MENU,
  LOBBY,
  PLAYING,
  UPGRADING,
  PAUSED,
  GAME_OVER
}

export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector;
  radius: number;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  xp: number;
  level: number;
  maxXp: number;
  attackPower: number;
  attackSpeed: number; // multiplier
  critRate: number;
  critDamage: number; // default 1.5
  lifesteal: number;
  pierce: number;
  multiShot: number;
  knockback: number;
  invincibleUntil: number;
  killCount: number;
  vel: Vector;
}

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  isElite: boolean;
  isFast: boolean;
  isBomber: boolean;
  color: string;
  xpValue: number;
  hitFlashUntil: number;
  currentDir?: Vector;
}

export interface Weapon {
  id: string;
  name: string;
  type: 'projectile' | 'melee';
  damage: number;
  cooldown: number; // ms
  lastFired: number;
  range: number;
  projectileSpeed?: number;
  color: string;
}

export interface Projectile extends Entity {
  velocity: Vector;
  damage: number;
  color: string;
  distanceTraveled: number;
  maxDistance: number;
  ownerId: string;
  pierceRemaining: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  type: 'STAT' | 'WEAPON';
  apply: (player: Player, weapons: Weapon[]) => void;
}

export interface DamageNumber {
  id: number;
  pos: Vector;
  value: number;
  isCrit: boolean;
  life: number; // 0 to 1
}

export interface XPgem extends Entity {
  value: number;
}

export interface Particle {
  id: string;
  pos: Vector;
  vel: Vector;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface GameState {
  status: GameStatus;
  player: Player;
  players: Record<string, Player>; // For multiplayer
  enemies: Enemy[];
  projectiles: Projectile[];
  weapons: Weapon[];
  xpGems: XPgem[];
  wave: number;
  gameTime: number;
  score: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  nextUpgrades: Upgrade[];
  damageNumbers: DamageNumber[];
  particles: Particle[];
}
