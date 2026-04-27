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

  // Grid background
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < GAME_WIDTH; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < GAME_HEIGHT; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); ctx.stroke();
  }

  // XP Gems
  state.xpGems.forEach(gem => {
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(gem.pos.x, gem.pos.y, gem.radius, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#8b5cf6';
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Projectiles
  state.projectiles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Simple motion trail
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(p.pos.x, p.pos.y);
    ctx.lineTo(p.pos.x - p.velocity.x * 2, p.pos.y - p.velocity.y * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  });

  // Particles
  state.particles.forEach(p => {
    const alpha = 1 - (p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;

  // Enemies
  state.enemies.forEach(enemy => {
    const isFlashing = state.gameTime < enemy.hitFlashUntil;
    ctx.fillStyle = isFlashing ? '#ffffff' : enemy.color;
    
    ctx.beginPath();
    ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

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
