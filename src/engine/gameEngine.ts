/**
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Player, 
  Enemy, 
  Projectile, 
  Weapon, 
  XPgem, 
  GameState, 
  Vector, 
  GameStatus,
  DamageNumber
} from '../types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  ENEMY_TEMPLATES, 
  INITIAL_PLAYER_STATS,
  WEAPON_TYPES 
} from '../constants';

export const createPlayer = (): Player => ({
  ...INITIAL_PLAYER_STATS,
  id: 'player',
  pos: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
  invincibleUntil: 0
});

export const spawnEnemy = (timeMs: number, playerPos: Vector): Enemy => {
  const side = Math.floor(Math.random() * 4);
  let pos = { x: 0, y: 0 };
  const offset = 50;

  if (side === 0) pos = { x: Math.random() * GAME_WIDTH, y: -offset };
  else if (side === 1) pos = { x: GAME_WIDTH + offset, y: Math.random() * GAME_HEIGHT };
  else if (side === 2) pos = { x: Math.random() * GAME_WIDTH, y: GAME_HEIGHT + offset };
  else pos = { x: -offset, y: Math.random() * GAME_HEIGHT };

  const timeMin = timeMs / 60000;
  
  // Weights change over time
  const eliteChance = Math.min(0.2, 0.02 + timeMin * 0.05);
  const fastChance = Math.min(0.4, 0.1 + timeMin * 0.03);

  let template = ENEMY_TEMPLATES.BASIC;
  let isElite = false;
  let isFast = false;

  const roll = Math.random();
  if (roll < eliteChance || (timeMs > 0 && Math.floor(timeMs / 30000) > Math.floor((timeMs - 16) / 30000))) {
      template = ENEMY_TEMPLATES.ELITE;
      isElite = true;
  } else if (roll < eliteChance + fastChance) {
      template = ENEMY_TEMPLATES.FAST;
      isFast = true;
  }

  // Scaling
  const hpScale = 1 + timeMin * 0.15;
  const dmgScale = 1 + timeMin * 0.1;

  return {
    id: Math.random().toString(36).substr(2, 9),
    pos,
    radius: template.radius,
    hp: Math.floor(template.hp * hpScale),
    maxHp: Math.floor(template.hp * hpScale),
    speed: template.speed,
    damage: Math.floor(template.damage * dmgScale),
    isElite,
    isFast,
    color: template.color
  };
};

export const getDistance = (v1: Vector, v2: Vector) => {
  return Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
};

export const getAngle = (v1: Vector, v2: Vector) => {
  return Math.atan2(v2.y - v1.y, v2.x - v1.x);
};

export const updatePlayer = (player: Player, keys: Set<string>, joystickVector?: Vector) => {
  const move = { x: 0, y: 0 };

  if (joystickVector && (joystickVector.x !== 0 || joystickVector.y !== 0)) {
    move.x = joystickVector.x;
    move.y = joystickVector.y;
  } else {
    if (keys.has('w') || keys.has('ArrowUp')) move.y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) move.y += 1;
    if (keys.has('a') || keys.has('ArrowLeft')) move.x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) move.x += 1;
  }

  if (move.x !== 0 || move.y !== 0) {
    if (!joystickVector || (joystickVector.x === 0 && joystickVector.y === 0)) {
      const length = Math.sqrt(move.x * move.x + move.y * move.y);
      player.pos.x += (move.x / length) * player.speed;
      player.pos.y += (move.y / length) * player.speed;
    } else {
      player.pos.x += move.x * player.speed;
      player.pos.y += move.y * player.speed;
    }
  }

  // Bounds
  player.pos.x = Math.max(player.radius, Math.min(GAME_WIDTH - player.radius, player.pos.x));
  player.pos.y = Math.max(player.radius, Math.min(GAME_HEIGHT - player.radius, player.pos.y));
};

export const updateEnemies = (state: GameState) => {
  const { player, enemies, gameTime } = state;
  
  enemies.forEach(enemy => {
    const angle = getAngle(enemy.pos, player.pos);
    enemy.pos.x += Math.cos(angle) * enemy.speed;
    enemy.pos.y += Math.sin(angle) * enemy.speed;

    // Collision with player
    const dist = getDistance(enemy.pos, player.pos);
    if (dist < enemy.radius + player.radius) {
      if (gameTime > player.invincibleUntil) {
        player.hp -= enemy.damage;
        player.invincibleUntil = gameTime + 500; // 0.5s i-frames
      }
    }
  });
};

export const autoFire = (state: GameState) => {
  const { player, enemies, weapons, projectiles, gameTime } = state;
  if (enemies.length === 0) return;

  weapons.forEach(weapon => {
    if (gameTime - weapon.lastFired >= weapon.cooldown / player.attackSpeed) {
      let nearest: Enemy | null = null;
      let minDist = weapon.range;

      enemies.forEach(enemy => {
        const dist = getDistance(player.pos, enemy.pos);
        if (dist < minDist) {
          minDist = dist;
          nearest = enemy;
        }
      });

      if (nearest) {
        weapon.lastFired = gameTime;
        const target = nearest as Enemy;
        const baseAngle = getAngle(player.pos, target.pos);
        
        const count = player.multiShot;
        const spread = 0.2; // Radians between bullets

        for(let i = 0; i < count; i++) {
            const angle = baseAngle + (i - (count - 1) / 2) * spread;
            
            projectiles.push({
               id: Math.random().toString(),
               pos: { ...player.pos },
               radius: 4,
               velocity: { 
                 x: Math.cos(angle) * (weapon.projectileSpeed || 5), 
                 y: Math.sin(angle) * (weapon.projectileSpeed || 5) 
               },
               damage: weapon.damage * player.attackPower,
               color: weapon.color,
               distanceTraveled: 0,
               maxDistance: weapon.range,
               ownerId: 'player',
               pierceRemaining: player.pierce
            });
        }
      }
    }
  });
};
