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
  invincibleUntil: 0,
  vel: { x: 0, y: 0 }
});

export const spawnEnemy = (timeMs: number, playerPos: Vector, difficultyFactor: number = 1): Enemy => {
  const side = Math.floor(Math.random() * 4);
  let pos = { x: 0, y: 0 };
  const offset = 50;

  if (side === 0) pos = { x: Math.random() * GAME_WIDTH, y: -offset };
  else if (side === 1) pos = { x: GAME_WIDTH + offset, y: Math.random() * GAME_HEIGHT };
  else if (side === 2) pos = { x: Math.random() * GAME_WIDTH, y: GAME_HEIGHT + offset };
  else pos = { x: -offset, y: Math.random() * GAME_HEIGHT };

  const timeMin = timeMs / 60000;
  
  // Weights change over time
  const eliteChance = Math.min(0.2, (0.02 + timeMin * 0.05) * difficultyFactor);
  const tankChance = Math.min(0.3, (0.05 + timeMin * 0.04) * difficultyFactor);
  const fastChance = Math.min(0.35, (0.1 + timeMin * 0.03) * difficultyFactor);
  const bomberChance = Math.min(0.2, (0.03 + timeMin * 0.06) * difficultyFactor);

  let template = ENEMY_TEMPLATES.BASIC;
  let isElite = false;
  let isFast = false;
  let isBomber = false;

  const roll = Math.random();
  if (roll < eliteChance || (timeMs > 0 && Math.floor(timeMs / 30000) > Math.floor((timeMs - 16) / 30000))) {
      template = ENEMY_TEMPLATES.ELITE;
      isElite = true;
  } else if (roll < eliteChance + tankChance) {
      template = ENEMY_TEMPLATES.TANK;
  } else if (roll < eliteChance + tankChance + fastChance) {
      template = ENEMY_TEMPLATES.FAST;
      isFast = true;
  } else if (roll < eliteChance + tankChance + fastChance + bomberChance) {
      template = ENEMY_TEMPLATES.BOMBER;
      isBomber = true;
  }

  // Scaling: base_hp × (1 + time × 0.15) - Reduced from 0.20 for lower difficulty
  const hpScale = (1 + timeMin * 0.15) * difficultyFactor;
  const dmgScale = (1 + timeMin * 0.12) * (1 + (difficultyFactor - 1) * 0.5); // Reduced from 0.15

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
    isBomber,
    color: template.color,
    xpValue: template.xp,
    hitFlashUntil: 0,
    currentDir: { x: 0, y: 0 }
  };
};

export const getDistance = (v1: Vector, v2: Vector) => {
  return Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
};

export const getAngle = (v1: Vector, v2: Vector) => {
  return Math.atan2(v2.y - v1.y, v2.x - v1.x);
};

export const updatePlayer = (player: Player, keys: Set<string>, joystickVector?: Vector) => {
  const targetMove = { x: 0, y: 0 };

  if (joystickVector && (joystickVector.x !== 0 || joystickVector.y !== 0)) {
    // 1. Deadzone (0.15)
    const deadzone = 0.15;
    const mag = Math.sqrt(joystickVector.x**2 + joystickVector.y**2);
    
    if (mag > deadzone) {
      // Re-scale input after deadzone to keep full range
      const normMag = (mag - deadzone) / (1 - deadzone);
      targetMove.x = (joystickVector.x / mag) * normMag;
      targetMove.y = (joystickVector.y / mag) * normMag;
    }
  } else {
    if (keys.has('w') || keys.has('ArrowUp')) targetMove.y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) targetMove.y += 1;
    if (keys.has('a') || keys.has('ArrowLeft')) targetMove.x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) targetMove.x += 1;
    
    // Normalize keyboard input
    if (targetMove.x !== 0 || targetMove.y !== 0) {
      const length = Math.sqrt(targetMove.x * targetMove.x + targetMove.y * targetMove.y);
      targetMove.x /= length;
      targetMove.y /= length;
    }
  }

  // 2. Acceleration / Friction System
  const acceleration = 0.45; // How fast we reach target speed
  const friction = 0.90;   // Inertia factor (0.88-0.94)
  
  // Calculate Target Velocity
  const targetVelX = targetMove.x * player.speed;
  const targetVelY = targetMove.y * player.speed;

  // Apply acceleration towards target
  player.vel.x += (targetVelX - player.vel.x) * acceleration;
  player.vel.y += (targetVelY - player.vel.y) * acceleration;

  // Apply friction (smooth stop)
  if (targetMove.x === 0 && targetMove.y === 0) {
      player.vel.x *= friction;
      player.vel.y *= friction;
  }

  // Final position update
  player.pos.x += player.vel.x;
  player.pos.y += player.vel.y;

  // Bounds
  player.pos.x = Math.max(player.radius, Math.min(GAME_WIDTH - player.radius, player.pos.x));
  player.pos.y = Math.max(player.radius, Math.min(GAME_HEIGHT - player.radius, player.pos.y));
};

export const spawnParticle = (state: GameState, pos: Vector, color: string, count = 5) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    state.particles.push({
      id: Math.random().toString(36).substr(2, 9),
      pos: { ...pos },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      color,
      life: 0,
      maxLife: 20 + Math.random() * 15,
      size: 1 + Math.random() * 2
    });
  }
};

export const spawnDamageNumber = (state: GameState, pos: Vector, value: number, isCrit = false) => {
  state.damageNumbers.push({
    id: Math.random(),
    pos: { x: pos.x, y: pos.y - 10 },
    value: Math.floor(value),
    isCrit,
    life: 1.0
  });
};

export const updateJuice = (state: GameState) => {
  // Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life++;
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.vel.x *= 0.96;
    p.vel.y *= 0.96;
    if (p.life >= p.maxLife) state.particles.splice(i, 1);
  }

  // Damage Numbers
  for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
    const d = state.damageNumbers[i];
    d.life -= 0.02;
    d.pos.y -= 0.5;
    if (d.life <= 0) state.damageNumbers.splice(i, 1);
  }
};

export const updateEnemies = (state: GameState, onShake: (amt: number) => void, onHit?: () => void) => {
  const { player, enemies, gameTime } = state;
  
  enemies.forEach(enemy => {
    const targetAngle = getAngle(enemy.pos, player.pos);
    
    // Smooth Steering
    if (!enemy.currentDir) {
        enemy.currentDir = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
    }
    
    const turnSpeed = 0.08;
    const targetDir = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
    enemy.currentDir.x += (targetDir.x - enemy.currentDir.x) * turnSpeed;
    enemy.currentDir.y += (targetDir.y - enemy.currentDir.y) * turnSpeed;

    // Movement with Separation
    const mag = Math.sqrt(enemy.currentDir.x ** 2 + enemy.currentDir.y ** 2);
    let moveX = (enemy.currentDir.x / mag) * enemy.speed;
    let moveY = (enemy.currentDir.y / mag) * enemy.speed;

    // Enemy-Enemy Separation (Simple)
    enemies.forEach(other => {
        if (enemy === other) return;
        const d = getDistance(enemy.pos, other.pos);
        if (d < enemy.radius + other.radius) {
            const angle = getAngle(other.pos, enemy.pos);
            const force = 0.5;
            moveX += Math.cos(angle) * force;
            moveY += Math.sin(angle) * force;
        }
    });

    enemy.pos.x += moveX;
    enemy.pos.y += moveY;

    // Collision with player
    const dist = getDistance(enemy.pos, player.pos);
    if (dist < enemy.radius + player.radius) {
      if (gameTime > player.invincibleUntil) {
        player.hp -= enemy.damage;
        player.invincibleUntil = gameTime + 1000;
        onShake(15);
        onHit?.();
        if (navigator.vibrate) navigator.vibrate(20);
      } else {
        // Pushing player slightly or sliding away
        const pushAngle = getAngle(player.pos, enemy.pos);
        enemy.pos.x += Math.cos(pushAngle) * 2;
        enemy.pos.y += Math.sin(pushAngle) * 2;
      }
    }
  });
};

export const autoFire = (state: GameState, onShoot?: () => void) => {
  const { player, enemies, weapons, projectiles, gameTime } = state;
  if (enemies.length === 0) return;

  weapons.forEach(weapon => {
    // 1. Always look for target for smooth rotation
    let targetEnemy: Enemy | null = null;
    let minVal = Infinity;

    enemies.forEach(enemy => {
      const dist = getDistance(player.pos, enemy.pos);
      if (dist < weapon.range) {
        const score = dist * 0.8 + (enemy.hp / enemy.maxHp) * dist * 0.2;
        if (score < minVal) {
          minVal = score;
          targetEnemy = enemy;
        }
      }
    });

    if (targetEnemy) {
        const bulletSpeed = weapon.projectileSpeed || 5;
        const dist = getDistance(player.pos, targetEnemy.pos);
        const timeToTarget = dist / bulletSpeed;
        const targetVel = targetEnemy.currentDir ? 
          { x: targetEnemy.currentDir.x * targetEnemy.speed, y: targetEnemy.currentDir.y * targetEnemy.speed } : 
          { x: 0, y: 0 };
          
        const predictedPos = {
          x: targetEnemy.pos.x + targetVel.x * timeToTarget * 0.5,
          y: targetEnemy.pos.y + targetVel.y * timeToTarget * 0.5
        };
        const targetAngle = getAngle(player.pos, predictedPos);
        
        if (weapon.currentAngle === undefined) weapon.currentAngle = targetAngle;
        let diff = targetAngle - weapon.currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        weapon.currentAngle += diff * 0.15; // Slower rotation when just tracking
    }

    // 2. Fire if ready
    const jitter = (Math.random() * 0.1 - 0.05); 
    const finalCooldown = (weapon.cooldown / player.attackSpeed) * (1 + jitter);

    if (gameTime - weapon.lastFired >= finalCooldown && targetEnemy) {
      weapon.lastFired = gameTime;
      onShoot?.();
      
      const shootingAngle = weapon.currentAngle || 0;
      const count = player.multiShot;
      const spread = 0.15;

      for(let i = 0; i < count; i++) {
          const randomInaccuracy = (Math.random() * 0.04 - 0.02);
          const angle = shootingAngle + (i - (count - 1) / 2) * spread + randomInaccuracy;
          
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
             maxDistance: weapon.range * 1.2,
             ownerId: 'player',
             pierceRemaining: player.pierce
          });
      }
    }
  });
};

export const updateProjectiles = (state: GameState, deltaTime: number, audio: any, setShake: (amt: any) => void) => {
  const { projectiles, enemies, player } = state;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    
    // --- Homing Logic (Commercial grade: light homing) ---
    let nearest: Enemy | null = null;
    let minDist = 150; // Homing range
    enemies.forEach(e => {
        const d = getDistance(p.pos, e.pos);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });

    if (nearest) {
        const targetAngle = getAngle(p.pos, nearest.pos);
        const pAngle = Math.atan2(p.velocity.y, p.velocity.x);
        
        // Slightly rotate velocity towards target
        const turnSpeed = 0.04; 
        const speed = Math.sqrt(p.velocity.x**2 + p.velocity.y**2);
        
        // Interpolate angle
        let diff = targetAngle - pAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        const newAngle = pAngle + diff * turnSpeed;
        p.velocity.x = Math.cos(newAngle) * speed;
        p.velocity.y = Math.sin(newAngle) * speed;
    }

    p.pos.x += p.velocity.x;
    p.pos.y += p.velocity.y;
    p.distanceTraveled += Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);

    let pRemoved = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (getDistance(p.pos, e.pos) < p.radius + e.radius) {
        audio.playSFX('hit', 0.05);
        const isCrit = Math.random() < player.critRate;
        let dmg = p.damage * (isCrit ? player.critDamage : 1);
        e.hp -= dmg;
        e.hitFlashUntil = state.gameTime + 80;
        
        // Knockback (enhanced)
        const angle = Math.atan2(e.pos.y - p.pos.y, e.pos.x - p.pos.x);
        const kbForce = 5 * (1 + player.knockback);
        e.pos.x += Math.cos(angle) * kbForce;
        e.pos.y += Math.sin(angle) * kbForce;

        // Feedback
        spawnParticle(state, e.pos, '#fff', 2);
        spawnDamageNumber(state, e.pos, dmg, isCrit);

        // Lifesteal
        if (player.lifesteal > 0) {
            player.hp = Math.min(player.maxHp, player.hp + dmg * player.lifesteal);
        }

        if (e.hp <= 0) {
            audio.playSFX('kill');
            state.score += e.isElite ? 500 : 100;
            player.killCount += 1;
            
            // Bomber explosion
            if (e.isBomber) {
                const distToPlayer = getDistance(e.pos, player.pos);
                const explosionRadius = 60;
                if (distToPlayer < explosionRadius + player.radius) {
                    player.hp -= e.damage;
                    setShake(15);
                }
                spawnParticle(state, e.pos, '#facc15', 20); 
            }

            state.xpGems.push({ 
                id: Math.random().toString(), 
                pos: { ...e.pos }, 
                radius: e.isElite ? 8 : 4, 
                value: e.xpValue || 1 
            });
            spawnParticle(state, e.pos, e.color, 12);
            setShake(e.isElite ? 12 : 5); // Stronger shake
            if (navigator.vibrate) navigator.vibrate(10);
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
};
