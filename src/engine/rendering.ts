/**
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState, Vector } from '../types';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

export const drawGame = (ctx: CanvasRenderingContext2D, state: GameState, shake: number = 0) => {
  ctx.save();
  
  // Screen Shake
  if (shake > 0) {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.translate(sx, sy);
  }

  // Clear
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Parallax Stars/Dust (Background Layer)
  const time = state.gameTime * 0.001;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 50; i++) {
      const x = (Math.sin(i * 123.45) + 1) * 0.5 * GAME_WIDTH;
      const y = ((Math.cos(i * 678.90) + 1) * 0.5 * GAME_HEIGHT + time * 10 * (1 + (i % 3))) % GAME_HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
  }

  // Grid background (Middle Layer)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  ctx.beginPath();
  for (let x = 0; x < GAME_WIDTH; x += gridSize) {
    ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT);
  }
  for (let y = 0; y < GAME_HEIGHT; y += gridSize) {
    ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y);
  }
  ctx.stroke();

  // XP Gems with better glow
  state.xpGems.forEach(gem => {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#8b5cf6';
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(gem.pos.x, gem.pos.y, gem.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner pulse
    const pulse = 0.8 + Math.sin(state.gameTime * 0.01) * 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(gem.pos.x, gem.pos.y, gem.radius * pulse * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Projectiles with glow and trails
  state.projectiles.forEach(p => {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle = '#ffffff'; // Bullet core
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow ring
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Motion trail (Dynamic)
    const trailLen = 4;
    const gradient = ctx.createLinearGradient(
        p.pos.x, p.pos.y, 
        p.pos.x - p.velocity.x * trailLen, p.pos.y - p.velocity.y * trailLen
    );
    gradient.addColorStop(0, p.color);
    gradient.addColorStop(1, 'transparent');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = p.radius * 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.pos.x, p.pos.y);
    ctx.lineTo(p.pos.x - p.velocity.x * trailLen, p.pos.y - p.velocity.y * trailLen);
    ctx.stroke();
    ctx.restore();
  });

  // Particles
  state.particles.forEach(p => {
    const age = p.life / p.maxLife;
    const alpha = 1 - age;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    // Stretch based on velocity
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    const speed = Math.sqrt(p.vel.x**2 + p.vel.y**2);
    const angle = Math.atan2(p.vel.y, p.vel.x);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * (1 + speed * 0.5), p.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1.0;

  // Enemies
  state.enemies.forEach(enemy => {
    const isFlashing = state.gameTime < enemy.hitFlashUntil;
    ctx.save();
    
    if (isFlashing) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = enemy.color;
    }
    
    // Creature body
    ctx.beginPath();
    ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes or accents for higher level feel
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const eyeSize = enemy.radius * 0.2;
    ctx.beginPath();
    ctx.arc(enemy.pos.x - enemy.radius*0.3, enemy.pos.y - enemy.radius*0.2, eyeSize, 0, Math.PI*2);
    ctx.arc(enemy.pos.x + enemy.radius*0.3, enemy.pos.y - enemy.radius*0.2, eyeSize, 0, Math.PI*2);
    ctx.fill();

    // Elite indicator
    if (enemy.isElite) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius + 6, state.gameTime * 0.01, state.gameTime * 0.01 + Math.PI * 1.5);
        ctx.stroke();
    }
    ctx.restore();

    // HP Bar for Elites
    if (enemy.isElite || enemy.hp < enemy.maxHp) {
      const barWidth = enemy.radius * 2.5;
      const barHeight = 4;
      ctx.fillStyle = '#334155';
      ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y - enemy.radius - 10, barWidth, barHeight);
      ctx.fillStyle = isFlashing ? '#ffffff' : '#ef4444';
      ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y - enemy.radius - 10, barWidth * (enemy.hp / enemy.maxHp), barHeight);
    }
  });

  // Player
  const { player } = state;

  // Other Players
  Object.entries(state.players).forEach(([id, otherPlayer]) => {
    if (otherPlayer.id === player.id) return;
    if (!otherPlayer.pos) return;

    ctx.save();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(otherPlayer.pos.x, otherPlayer.pos.y, otherPlayer.radius || 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const isInvincible = state.gameTime < player.invincibleUntil;
  ctx.save();
  if (isInvincible && Math.floor(state.gameTime / 50) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  // Outer Glow
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#60a5fa';
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(player.pos.x, player.pos.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(player.pos.x, player.pos.y, player.radius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Damage Numbers
  state.damageNumbers.forEach(dn => {
    ctx.fillStyle = dn.isCrit ? '#fbbf24' : '#fff';
    ctx.font = `black ${dn.isCrit ? 'bold 16px' : '12px'} Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = dn.life;
    ctx.fillText(dn.value.toString(), dn.pos.x, dn.pos.y);
    ctx.globalAlpha = 1.0;
  });

  ctx.restore();
};
