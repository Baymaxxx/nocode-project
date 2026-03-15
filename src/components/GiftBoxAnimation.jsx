import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ─── 缓动函数 ────────────────────────────────────────────────
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInQuad = t => t * t;
const easeInCubic = t => t * t * t;
const easeOutElastic = t => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
};
const easeOutBounce = t => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── 黄蓝紫橙色系烟花颜色 ────────────────────────────────────
const FIREWORK_COLORS = [
  '#FFD60A', '#FFCC00', '#FFB800', '#FFA500',  // 黄色系
  '#FF9F0A', '#FF8C00', '#FF6B00', '#FF5500',  // 橙色系
  '#007AFF', '#0A84FF', '#32ADE6', '#5AC8FA',  // 蓝色系
  '#AF52DE', '#BF5AF2', '#9B59B6', '#8E44AD',  // 紫色系
  '#FFD700', '#FFC107', '#FF9800', '#5856D6',  // 混合
];

// ─── 星星颜色（白色/金色/银色系） ────────────────────────────
const STAR_COLORS = [
  '#FFFFFF', '#FFFDE7', '#FFF9C4', '#FFD700',
  '#E3F2FD', '#BBDEFB', '#F3E5F5', '#EDE7F6',
];

// ─── 创建烟花爆炸粒子 ─────────────────────────────────────────
function createExplosion(cx, cy, count = 200, spread = 1) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (3 + Math.random() * 9) * spread;
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const type = Math.random() < 0.35 ? 'star' : Math.random() < 0.55 ? 'circle' : 'ribbon';
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 4,
      color,
      size: 2 + Math.random() * 7,
      life: 0.85 + Math.random() * 0.15,
      decay: 0.007 + Math.random() * 0.011,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      gravity: 0.1 + Math.random() * 0.08,
      type,
    });
  }
  return particles;
}

// ─── 创建掉落星星 ─────────────────────────────────────────────
function createFallingStars(W, H, count = 120) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.5,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.5 + Math.random() * 3.5,
      size: 1.5 + Math.random() * 4,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.05 + Math.random() * 0.1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      life: 1,
      decay: 0.003 + Math.random() * 0.004,
    });
  }
  return stars;
}

// ─── 绘制粒子 ─────────────────────────────────────────────────
function drawParticle(ctx, p) {
  if (p.life <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.shadowColor = p.color;
  ctx.shadowBlur = p.size * 2;

  if (p.type === 'star') {
    drawStar(ctx, 0, 0, p.size * 0.45, p.size, 5, p.color);
  } else if (p.type === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size * 0.35, -p.size * 1.2, p.size * 0.7, p.size * 2.4);
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, ir, or, pts, color) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? or : ir;
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
            : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ─── 绘制掉落星星 ─────────────────────────────────────────────
function drawFallingStar(ctx, s) {
  if (s.life <= 0) return;
  const twinkle = 0.5 + 0.5 * Math.sin(s.twinkle);
  ctx.save();
  ctx.globalAlpha = Math.max(0, s.life) * twinkle;
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rotation);
  ctx.shadowColor = s.color;
  ctx.shadowBlur = s.size * 3;
  drawStar(ctx, 0, 0, s.size * 0.4, s.size, 4, s.color);
  ctx.restore();
}

// ─── 冲击波 ───────────────────────────────────────────────────
function drawShockwave(ctx, cx, cy, radius, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255,200,100,0)');
  grad.addColorStop(0.5, 'rgba(255,150,50,0.6)');
  grad.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// ─── 绘制3D飞机 ───────────────────────────────────────────────
function drawAirplane(ctx, x, y, scale, perspective) {
  ctx.save();
  ctx.translate(x, y);

  // 3D透视缩放（越远越小，越近越大）
  const s = scale;
  ctx.scale(s, s * (0.6 + perspective * 0.4)); // Y轴压缩模拟透视

  // 机身阴影（3D感）
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 15 * s;
  ctx.shadowOffsetY = 5 * s;

  // 机身主体
  const bodyGrad = ctx.createLinearGradient(-40, -8, -40, 8);
  bodyGrad.addColorStop(0, '#E8F4FD');
  bodyGrad.addColorStop(0.3, '#C8E6F8');
  bodyGrad.addColorStop(0.7, '#A0C8E8');
  bodyGrad.addColorStop(1, '#7AAEC8');
  ctx.beginPath();
  ctx.moveTo(30, 0);        // 机头
  ctx.bezierCurveTo(20, -7, -10, -9, -35, -7);
  ctx.lineTo(-45, -4);
  ctx.lineTo(-45, 4);
  ctx.lineTo(-35, 7);
  ctx.bezierCurveTo(-10, 9, 20, 7, 30, 0);
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // 机身高光
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const highlightGrad = ctx.createLinearGradient(-40, -8, -40, 0);
  highlightGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
  highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(28, -1);
  ctx.bezierCurveTo(18, -6, -10, -8, -34, -6);
  ctx.lineTo(-44, -3);
  ctx.lineTo(-44, 0);
  ctx.bezierCurveTo(-10, -2, 18, -2, 28, -1);
  ctx.closePath();
  ctx.fillStyle = highlightGrad;
  ctx.fill();

  // 主翼（上方）
  const wingGrad = ctx.createLinearGradient(-5, -30, -5, 0);
  wingGrad.addColorStop(0, '#B8D8F0');
  wingGrad.addColorStop(1, '#90B8D8');
  ctx.beginPath();
  ctx.moveTo(5, -5);
  ctx.lineTo(-15, -5);
  ctx.lineTo(-25, -28);
  ctx.lineTo(-5, -28);
  ctx.lineTo(8, -5);
  ctx.closePath();
  ctx.fillStyle = wingGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,160,200,0.5)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 主翼（下方，3D感）
  const wingGrad2 = ctx.createLinearGradient(-5, 0, -5, 28);
  wingGrad2.addColorStop(0, '#90B8D8');
  wingGrad2.addColorStop(1, '#6898B8');
  ctx.beginPath();
  ctx.moveTo(5, 5);
  ctx.lineTo(-15, 5);
  ctx.lineTo(-22, 24);
  ctx.lineTo(-3, 24);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fillStyle = wingGrad2;
  ctx.fill();
  ctx.stroke();

  // 尾翼（垂直）
  ctx.beginPath();
  ctx.moveTo(-35, -6);
  ctx.lineTo(-42, -20);
  ctx.lineTo(-30, -6);
  ctx.closePath();
  ctx.fillStyle = '#A0C8E8';
  ctx.fill();

  // 尾翼（水平）
  ctx.beginPath();
  ctx.moveTo(-32, -4);
  ctx.lineTo(-44, -4);
  ctx.lineTo(-44, -10);
  ctx.lineTo(-30, -4);
  ctx.closePath();
  ctx.fillStyle = '#B0D0E8';
  ctx.fill();

  // 发动机
  const engineGrad = ctx.createLinearGradient(-8, -14, -8, -8);
  engineGrad.addColorStop(0, '#D0E8F8');
  engineGrad.addColorStop(1, '#88B8D8');
  ctx.beginPath();
  ctx.ellipse(-8, -11, 8, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = engineGrad;
  ctx.fill();

  // 发动机喷口火焰
  const flameGrad = ctx.createRadialGradient(-18, -11, 0, -18, -11, 10);
  flameGrad.addColorStop(0, 'rgba(255,255,200,0.9)');
  flameGrad.addColorStop(0.3, 'rgba(255,180,50,0.7)');
  flameGrad.addColorStop(0.7, 'rgba(255,100,20,0.4)');
  flameGrad.addColorStop(1, 'rgba(255,50,0,0)');
  ctx.beginPath();
  ctx.ellipse(-22, -11, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = flameGrad;
  ctx.fill();

  // 机窗
  ctx.fillStyle = 'rgba(150,210,255,0.8)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(15 - i * 10, -3, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,170,220,0.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 机头驾驶舱
  ctx.beginPath();
  ctx.ellipse(22, -2, 6, 4, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(180,230,255,0.7)';
  ctx.fill();

  ctx.restore();
}

// ─── 绘制飞机尾迹（3D云雾感） ─────────────────────────────────
function drawAirplaneTrail(ctx, trail) {
  trail.forEach((pt, i) => {
    const alpha = (i / trail.length) * 0.4 * pt.life;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = pt.size;
    const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.5, 'rgba(200,220,255,0.4)');
    grad.addColorStop(1, 'rgba(150,180,255,0)');
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  });
}

// ─── 绘制降落伞 ───────────────────────────────────────────────
function drawParachute(ctx, x, y, scale, swing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(swing * 0.08);

  // 伞绳
  ctx.strokeStyle = 'rgba(180,160,140,0.8)';
  ctx.lineWidth = 0.8;
  const ropePoints = [
    [-18, 0], [-12, 0], [-6, 0], [0, 0], [6, 0], [12, 0], [18, 0]
  ];
  ropePoints.forEach(([rx]) => {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.quadraticCurveTo(rx * 0.3, 30, 0, 45);
    ctx.stroke();
  });

  // 伞盖
  const chuteColors = [
    '#FF9F0A', '#FFD60A', '#007AFF', '#AF52DE',
    '#FF6B00', '#5AC8FA', '#BF5AF2', '#FFB800',
  ];
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const startAngle = Math.PI + (i / segments) * Math.PI;
    const endAngle = Math.PI + ((i + 1) / segments) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 45, startAngle, endAngle);
    ctx.closePath();
    const segGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 45);
    segGrad.addColorStop(0, chuteColors[i] + 'CC');
    segGrad.addColorStop(1, chuteColors[i] + '88');
    ctx.fillStyle = segGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 伞盖高光
  ctx.beginPath();
  ctx.arc(0, 0, 45, Math.PI, Math.PI * 2);
  ctx.closePath();
  const shineGrad = ctx.createRadialGradient(-10, -20, 0, 0, 0, 45);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
  shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  ctx.fill();

  // 伞盖边缘
  ctx.beginPath();
  ctx.arc(0, 0, 45, Math.PI, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// ─── 绘制PDF文件图标 ──────────────────────────────────────────
function drawPdfIcon(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 文件阴影
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;

  // 文件主体
  const fileGrad = ctx.createLinearGradient(-18, -24, 18, 24);
  fileGrad.addColorStop(0, '#FFFFFF');
  fileGrad.addColorStop(1, '#F0F0F0');
  ctx.beginPath();
  ctx.moveTo(-18, -24);
  ctx.lineTo(10, -24);
  ctx.lineTo(18, -16);
  ctx.lineTo(18, 24);
  ctx.lineTo(-18, 24);
  ctx.closePath();
  ctx.fillStyle = fileGrad;
  ctx.fill();

  // 折角
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.moveTo(10, -24);
  ctx.lineTo(10, -16);
  ctx.lineTo(18, -16);
  ctx.closePath();
  ctx.fillStyle = '#E0E0E0';
  ctx.fill();

  // PDF红色标签
  ctx.beginPath();
  ctx.roundRect(-18, -6, 36, 14, 2);
  ctx.fillStyle = '#FF3B30';
  ctx.fill();

  // PDF文字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PDF', 0, 1);

  // 文件线条
  ctx.strokeStyle = '#D0D0D0';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-12, 12 + i * 4);
    ctx.lineTo(12, 12 + i * 4);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── 绘制飞行员小人 ───────────────────────────────────────────
function drawPilot(ctx, x, y, scale, armAngle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 身体阴影
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  // 腿部
  ctx.strokeStyle = '#4A3728';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // 左腿
  ctx.beginPath();
  ctx.moveTo(-5, 20);
  ctx.lineTo(-8, 38);
  ctx.stroke();
  // 右腿
  ctx.beginPath();
  ctx.moveTo(5, 20);
  ctx.lineTo(8, 38);
  ctx.stroke();

  // 靴子
  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.ellipse(-8, 40, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8, 40, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 飞行服主体
  const suitGrad = ctx.createLinearGradient(-12, -5, 12, 25);
  suitGrad.addColorStop(0, '#5B7FA6');
  suitGrad.addColorStop(0.5, '#4A6B8A');
  suitGrad.addColorStop(1, '#3A5570');
  ctx.beginPath();
  ctx.roundRect(-12, -5, 24, 28, 4);
  ctx.fillStyle = suitGrad;
  ctx.shadowColor = 'transparent';
  ctx.fill();

  // 飞行服细节（拉链/口袋）
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 15);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.roundRect(-10, 5, 8, 6, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(2, 5, 8, 6, 1);
  ctx.fill();

  // 手臂（动态角度，双手向前伸出递PDF）
  const leftArmAngle = armAngle;
  const rightArmAngle = -armAngle;

  // 左臂
  ctx.strokeStyle = '#5B7FA6';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  const lax = -12 + Math.cos(Math.PI + leftArmAngle) * 20;
  const lay = 2 + Math.sin(Math.PI + leftArmAngle) * 20;
  ctx.lineTo(lax, lay);
  ctx.stroke();

  // 右臂
  ctx.beginPath();
  ctx.moveTo(12, 2);
  const rax = 12 + Math.cos(rightArmAngle) * 20;
  const ray = 2 + Math.sin(rightArmAngle) * 20;
  ctx.lineTo(rax, ray);
  ctx.stroke();

  // 手套
  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.arc(lax, lay, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rax, ray, 4, 0, Math.PI * 2);
  ctx.fill();

  // 头部
  const headGrad = ctx.createRadialGradient(-2, -18, 2, 0, -16, 12);
  headGrad.addColorStop(0, '#FFDAB9');
  headGrad.addColorStop(0.7, '#F4A460');
  headGrad.addColorStop(1, '#D2691E');
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fillStyle = headGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 5;
  ctx.fill();

  // 飞行员头盔
  const helmetGrad = ctx.createLinearGradient(-12, -28, 12, -10);
  helmetGrad.addColorStop(0, '#8B9DC3');
  helmetGrad.addColorStop(0.4, '#6B7FA3');
  helmetGrad.addColorStop(1, '#4A5F83');
  ctx.beginPath();
  ctx.arc(0, -18, 13, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fillStyle = helmetGrad;
  ctx.shadowColor = 'transparent';
  ctx.fill();

  // 头盔护目镜
  const goggleGrad = ctx.createLinearGradient(-8, -22, 8, -14);
  goggleGrad.addColorStop(0, 'rgba(100,180,255,0.8)');
  goggleGrad.addColorStop(1, 'rgba(50,120,200,0.6)');
  ctx.beginPath();
  ctx.ellipse(0, -18, 9, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = goggleGrad;
  ctx.fill();
  ctx.strokeStyle = '#FFD60A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 护目镜高光
  ctx.beginPath();
  ctx.ellipse(-2, -20, 4, 2, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();

  // 头盔徽章
  ctx.fillStyle = '#FFD60A';
  drawStar(ctx, 0, -28, 2, 4, 5, '#FFD60A');

  // 围巾/领巾
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.bezierCurveTo(-6, 0, 6, 0, 8, -6);
  ctx.bezierCurveTo(6, -2, -6, -2, -8, -6);
  ctx.fillStyle = '#FF6B35';
  ctx.fill();

  // 笑脸
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -15, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // 眼睛
  ctx.fillStyle = '#4A3728';
  ctx.beginPath();
  ctx.arc(-3, -18, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -18, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 生成静态星空背景点 ──────────────────────────────────────
function generateStarField(W, H, count = 200) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.3 + Math.random() * 1.8,
      alpha: 0.2 + Math.random() * 0.7,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.008 + Math.random() * 0.015,
    });
  }
  return stars;
}

// ─── 绘制星空背景 ─────────────────────────────────────────────
function drawStarryBackground(ctx, W, H, bgStars, now) {
  // 深空渐变
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  bg.addColorStop(0,   '#0d1b3e');
  bg.addColorStop(0.4, '#060d1f');
  bg.addColorStop(1,   '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 静态背景星星（闪烁）
  bgStars.forEach(s => {
    s.twinkleOffset += s.twinkleSpeed;
    const a = s.alpha * (0.5 + 0.5 * Math.sin(s.twinkleOffset));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#aad4ff';
    ctx.shadowBlur = s.r * 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── 主组件 ───────────────────────────────────────────────────
// phase prop 只在挂载时读取一次，后续动画完全由内部驱动
const GiftBoxAnimation = ({ progressMsg, fileName, onAnimationDone, onReadyForResult }) => {
  const canvasRef = useRef(null);
  const bgStarsRef = useRef([]);
  // 用 ref 保持回调最新引用，避免闭包捕获旧属性
  const onAnimationDoneRef = useRef(onAnimationDone);
  const onReadyForResultRef = useRef(onReadyForResult);
  useEffect(() => { onAnimationDoneRef.current = onAnimationDone; }, [onAnimationDone]);
  useEffect(() => { onReadyForResultRef.current = onReadyForResult; }, [onReadyForResult]);
  const stateRef = useRef({
    internalPhase: 'idle',
    startTime: null,
    particles: [],
    shockwaves: [],
    fallingStars: [],
    raf: null,
    // 飞机
    planeX: 0, planeY: 0,
    planeScale: 0.1,
    planePerspective: 0,
    planeTrail: [],
    // 爆炸
    flashOpacity: 0,
    // 文字
    textScale: 0,
    textOpacity: 0,
    textShake: 0,
    // 降落伞阶段
    parachuteY: -200,
    parachuteSwing: 0,
    parachuteSwingDir: 1,
    parachuteScale: 0,
    parachuteOpacity: 0,
    // 飞行员
    pilotArmAngle: 0.3,
    pilotArmDir: 1,
    // 星星雨
    starsSpawned: false,
    dismissed: false,
    onFadeOutProgress: null,
    onDismiss: null,
  });

  // 挂载即启动动画，不依赖外部 phase prop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const s = stateRef.current;
    s.internalPhase = 'fly';
    s.startTime = null;
    s.particles = [];
    s.shockwaves = [];
    s.fallingStars = [];
    s.flashOpacity = 0;
    s.textScale = 0;
    s.textOpacity = 0;
    s.starsSpawned = false;
    s.parachuteY = -300;
    s.parachuteSwing = 0;
    s.parachuteSwingDir = 1;
    s.parachuteScale = 0;
    s.parachuteOpacity = 0;
    s.pilotArmAngle = 0.3;
    s.pilotArmDir = 1;
    s.planeTrail = [];
    s.dismissed = false;
    s.fadeOutAlpha = 0;  // canvas 内部黑色淡出层透明度 0→1
    s.onDismiss = () => { if (onAnimationDoneRef.current) onAnimationDoneRef.current(); };

    // 初始化星空背景
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    bgStarsRef.current = generateStarField(canvas.width, canvas.height, 220);

    const loop = (now) => {
      if (!s.startTime) s.startTime = now;
      const elapsed = now - s.startTime;

      // 动态调整 canvas 尺寸
      const prevW = canvas.width, prevH = canvas.height;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // 尺寸变化时重新生成星空
      if (canvas.width !== prevW || canvas.height !== prevH) {
        bgStarsRef.current = generateStarField(canvas.width, canvas.height, 220);
      }
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;

      const ctx = canvas.getContext('2d');
      // 绘制星空背景（替代纯黑）
      drawStarryBackground(ctx, W, H, bgStarsRef.current, now);

      // ══════════════════════════════════════════════════════
      // 阶段1：飞机从屏幕左上角飞来（3D效果）0~2200ms
      // ══════════════════════════════════════════════════════
      if (s.internalPhase === 'fly') {
        const dur = 3500; // 拉长飞行时间，让飞机过程更明显
        const t = Math.min(elapsed / dur, 1);
        const et = easeInCubic(t); // 加速飞入

        // 起始：屏幕左上角角落（稍微出屏幕外）
        const startX = -20;
        const startY = -20;
        const endX = cx;
        const endY = cy;

        // 贝塞尔弧线轨迹：控制点偏右上，让飞机走弧线冲入
        const cpX = W * 0.2;
        const cpY = H * 0.08;
        // 二次贝塞尔插值
        const bx = (1 - et) * (1 - et) * startX + 2 * (1 - et) * et * cpX + et * et * endX;
        const by = (1 - et) * (1 - et) * startY + 2 * (1 - et) * et * cpY + et * et * endY;

        s.planeX = bx;
        s.planeY = by;
        // 3D缩放：从0.25（清晰可见）到3.5（冲向屏幕的感觉）
        s.planeScale = lerp(0.25, 3.5, et);
        // 透视感：从扁平（远处）到正常
        s.planePerspective = lerp(0, 1, t);

        // 飞机尾迹（云雾状）
        if (t > 0.02 && Math.random() < 0.75) {
          s.planeTrail.push({
            x: s.planeX - Math.cos(0) * 40 * s.planeScale * 0.3,
            y: s.planeY + 5 * s.planeScale * 0.3,
            size: (8 + Math.random() * 12) * s.planeScale * 0.4,
            life: 1,
            decay: 0.012 + Math.random() * 0.01,
          });
        }
        // 更新尾迹
        s.planeTrail.forEach(pt => { pt.life -= pt.decay; pt.size *= 1.02; });
        s.planeTrail = s.planeTrail.filter(pt => pt.life > 0);

        // 绘制尾迹
        drawAirplaneTrail(ctx, s.planeTrail);

        // 绘制飞机
        drawAirplane(ctx, s.planeX, s.planeY, s.planeScale, s.planePerspective);

        // 进度文字（飞行中）
        if (progressMsg) {
          ctx.save();
          ctx.globalAlpha = 0.7;
          ctx.font = '14px -apple-system, sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 8;
          ctx.fillText(progressMsg, cx, H - 60);
          ctx.restore();
        }

        if (t >= 1) {
          s.internalPhase = 'explode';
          s.startTime = now;
          s.planeTrail = [];

          // 大爆炸！黄蓝紫橙色系
          s.particles = createExplosion(cx, cy, 350, 1.6);

          // 多波次爆炸（延迟触发）
          for (let i = 0; i < 10; i++) {
            setTimeout(() => {
              const rx = cx + (Math.random() - 0.5) * W * 0.7;
              const ry = cy + (Math.random() - 0.5) * H * 0.5;
              s.particles.push(...createExplosion(rx, ry, 100, 0.9));
              s.shockwaves.push({ x: rx, y: ry, r: 0, maxR: 180 + Math.random() * 120, opacity: 0.7 });
            }, i * 100);
          }
          s.shockwaves.push({ x: cx, y: cy, r: 0, maxR: Math.max(W, H) * 0.9, opacity: 1 });
          s.flashOpacity = 1;
        }
      }

      // ══════════════════════════════════════════════════════
      // 阶段2：爆炸 + 烟花 2200~5200ms
      // ══════════════════════════════════════════════════════
      else if (s.internalPhase === 'explode') {
        const dur = 3000;
        const t = Math.min(elapsed / dur, 1);

        // 白色闪光衰减
        s.flashOpacity = Math.max(0, s.flashOpacity - 0.035);
        if (s.flashOpacity > 0) {
          ctx.fillStyle = `rgba(255,255,255,${s.flashOpacity})`;
          ctx.fillRect(0, 0, W, H);
        }

        // 冲击波
        s.shockwaves.forEach(sw => {
          sw.r += (sw.maxR - sw.r) * 0.07;
          sw.opacity *= 0.94;
          if (sw.opacity > 0.01) drawShockwave(ctx, sw.x, sw.y, sw.r, sw.opacity);
        });

        // 更新烟花粒子
        s.particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += p.gravity; p.vx *= 0.99;
          p.rotation += p.rotSpeed;
          p.life -= p.decay;
        });
        s.particles = s.particles.filter(p => p.life > 0);

        // 持续补充烟花（黄蓝紫橙）
        if (t < 0.75 && Math.random() < 0.18) {
          const rx = Math.random() * W;
          const ry = Math.random() * H * 0.85;
          s.particles.push(...createExplosion(rx, ry, 50, 0.7));
        }

        s.particles.forEach(p => drawParticle(ctx, p));

        // 0.5s后开始生成星星雨
        if (t > 0.4 && !s.starsSpawned) {
          s.starsSpawned = true;
          s.fallingStars = createFallingStars(W, H, 150);
        }

        // 更新并绘制星星
        s.fallingStars.forEach(star => {
          star.x += star.vx;
          star.y += star.vy;
          star.twinkle += star.twinkleSpeed;
          star.rotation += star.rotSpeed;
          star.life -= star.decay;
          drawFallingStar(ctx, star);
        });
        s.fallingStars = s.fallingStars.filter(s => s.life > 0 && s.y < H + 50);

        if (t >= 1) {
          s.internalPhase = 'stars';
          s.startTime = now;
          // 补充更多星星
          s.fallingStars.push(...createFallingStars(W, H, 100));
        }
      }

      // ══════════════════════════════════════════════════════
      // 阶段3：满天星星掉落 5200~7200ms
      // ══════════════════════════════════════════════════════
      else if (s.internalPhase === 'stars') {
        const dur = 2000;
        const t = Math.min(elapsed / dur, 1);

        // 持续少量烟花
        if (Math.random() < 0.06) {
          const rx = Math.random() * W;
          const ry = Math.random() * H * 0.6;
          s.particles.push(...createExplosion(rx, ry, 25, 0.5));
        }
        s.particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += p.gravity; p.vx *= 0.99;
          p.rotation += p.rotSpeed;
          p.life -= p.decay;
        });
        s.particles = s.particles.filter(p => p.life > 0);
        s.particles.forEach(p => drawParticle(ctx, p));

        // 持续补充星星
        if (Math.random() < 0.4) {
          s.fallingStars.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1.5 + Math.random() * 3,
            size: 1.5 + Math.random() * 4,
            color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.05 + Math.random() * 0.1,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.08,
            life: 1,
            decay: 0.003 + Math.random() * 0.004,
          });
        }

        s.fallingStars.forEach(star => {
          star.x += star.vx;
          star.y += star.vy;
          star.twinkle += star.twinkleSpeed;
          star.rotation += star.rotSpeed;
          star.life -= star.decay;
          drawFallingStar(ctx, star);
        });
        s.fallingStars = s.fallingStars.filter(s => s.life > 0 && s.y < H + 50);

        if (t >= 1) {
          s.internalPhase = 'parachute';
          s.startTime = now;
          s.parachuteY = -200;
          s.parachuteScale = 0;
          s.parachuteOpacity = 0;
        }
      }

      // ══════════════════════════════════════════════════════
      // 阶段4：PDF随降落伞缓缓降落 + 飞行员递给用户 7200~11200ms
      // ══════════════════════════════════════════════════════
      else if (s.internalPhase === 'parachute') {
        const dur = 4000;
        const t = Math.min(elapsed / dur, 1);

        // 少量背景星星
        if (Math.random() < 0.15) {
          s.fallingStars.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 1,
            vy: 1 + Math.random() * 2,
            size: 1 + Math.random() * 3,
            color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.05 + Math.random() * 0.08,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.06,
            life: 0.8,
            decay: 0.004 + Math.random() * 0.003,
          });
        }
        s.fallingStars.forEach(star => {
          star.x += star.vx;
          star.y += star.vy;
          star.twinkle += star.twinkleSpeed;
          star.rotation += star.rotSpeed;
          star.life -= star.decay;
          drawFallingStar(ctx, star);
        });
        s.fallingStars = s.fallingStars.filter(s => s.life > 0 && s.y < H + 50);

        // 降落伞从上方缓缓降落
        const targetY = cy - 60;
        const dropT = easeOutCubic(Math.min(t * 1.2, 1));
        s.parachuteY = lerp(-200, targetY, dropT);
        s.parachuteScale = lerp(0, 1.2, easeOutElastic(Math.min(t * 1.5, 1)));
        s.parachuteOpacity = Math.min(t * 5, 1);

        // 降落伞左右摇摆
        s.parachuteSwing += 0.04 * s.parachuteSwingDir;
        if (Math.abs(s.parachuteSwing) > 1) s.parachuteSwingDir *= -1;

        // 飞行员手臂动画（递PDF动作）
        s.pilotArmAngle += 0.03 * s.pilotArmDir;
        if (s.pilotArmAngle > 0.6 || s.pilotArmAngle < 0.1) s.pilotArmDir *= -1;

        // 绘制降落伞
        ctx.save();
        ctx.globalAlpha = s.parachuteOpacity;
        drawParachute(ctx, cx, s.parachuteY, s.parachuteScale, s.parachuteSwing);
        ctx.restore();

        // 绘制PDF图标（挂在降落伞下方）
        const pdfY = s.parachuteY + 55 * s.parachuteScale;
        ctx.save();
        ctx.globalAlpha = s.parachuteOpacity;
        drawPdfIcon(ctx, cx, pdfY, s.parachuteScale * 0.9);
        ctx.restore();

        // 飞行员（在PDF下方，双手向上递）
        const pilotY = pdfY + 50 * s.parachuteScale;
        if (t > 0.3) {
          const pilotT = Math.min((t - 0.3) / 0.4, 1);
          ctx.save();
          ctx.globalAlpha = s.parachuteOpacity * pilotT;
          drawPilot(ctx, cx, pilotY, s.parachuteScale * 0.85, s.pilotArmAngle);
          ctx.restore();
        }

        // 文字提示
        if (t > 0.5) {
          const textT = Math.min((t - 0.5) / 0.3, 1);
          ctx.save();
          ctx.globalAlpha = textT;
          ctx.font = 'bold 18px -apple-system, "SF Pro Display", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('✈️ 飞行员为您送来解析结果！', cx, pilotY + 70 * s.parachuteScale);
          if (fileName) {
            ctx.font = '14px -apple-system, sans-serif';
            ctx.fillStyle = 'rgba(255,255,200,0.9)';
            ctx.fillText(fileName, cx, pilotY + 95 * s.parachuteScale);
          }
          ctx.restore();
        }

        if (t >= 1) {
          s.internalPhase = 'done';
          s.startTime = now;
          // 通知外部：动画完成，可以展示结果（数据层面）
          if (onReadyForResultRef.current) onReadyForResultRef.current();
        }
      }

      // ══════════════════════════════════════════════════════
      // 阶段5：完成展示 + 淡出 (3s 后淡出)
      // ══════════════════════════════════════════════════════
      else if (s.internalPhase === 'done') {
        const doneElapsed = now - s.startTime;
        // 3s 后开始淡出背景遮罩
        const fadeOutT = clamp((doneElapsed - 3000) / 1200, 0, 1);
        s.fadeOutAlpha = fadeOutT;
        // 全黑后再等一帧再卸载，避免闪烁
        if (fadeOutT >= 1 && !s.dismissed) {
          s.dismissed = true;
          // 延迟一帧再触发，确保黑屏帧已渲染
          requestAnimationFrame(() => {
            if (s.onDismiss) s.onDismiss();
          });
        }
        // 少量星星背景
        if (Math.random() < 0.08) {
          s.fallingStars.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 0.8 + Math.random() * 1.5,
            size: 1 + Math.random() * 2.5,
            color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.04 + Math.random() * 0.07,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.05,
            life: 0.7,
            decay: 0.005,
          });
        }
        s.fallingStars.forEach(star => {
          star.x += star.vx;
          star.y += star.vy;
          star.twinkle += star.twinkleSpeed;
          star.rotation += star.rotSpeed;
          star.life -= star.decay;
          drawFallingStar(ctx, star);
        });
        s.fallingStars = s.fallingStars.filter(s => s.life > 0 && s.y < H + 50);

        // 降落伞悬停
        s.parachuteSwing += 0.03 * s.parachuteSwingDir;
        if (Math.abs(s.parachuteSwing) > 0.8) s.parachuteSwingDir *= -1;
        s.pilotArmAngle += 0.025 * s.pilotArmDir;
        if (s.pilotArmAngle > 0.6 || s.pilotArmAngle < 0.1) s.pilotArmDir *= -1;

        const targetY = cy - 60;
        drawParachute(ctx, cx, targetY, 1.2, s.parachuteSwing);
        const pdfY = targetY + 55 * 1.2;
        drawPdfIcon(ctx, cx, pdfY, 1.2 * 0.9);
        const pilotY = pdfY + 50 * 1.2;
        drawPilot(ctx, cx, pilotY, 1.2 * 0.85, s.pilotArmAngle);

        ctx.save();
        ctx.font = 'bold 18px -apple-system, "SF Pro Display", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('✈️ 飞行员为您送来解析结果！', cx, pilotY + 70 * 1.2);
        if (fileName) {
          ctx.font = '14px -apple-system, sans-serif';
          ctx.fillStyle = 'rgba(255,255,200,0.9)';
          ctx.fillText(fileName, cx, pilotY + 95 * 1.2);
        }
        ctx.restore();

        // 在 done 阶段：canvas 内部黑色淡出覆盖层
        if (s.fadeOutAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = s.fadeOutAlpha;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
      }

      s.raf = requestAnimationFrame(loop);
    };

    s.raf = requestAnimationFrame(loop);

    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
    };
  }, []); // 挂载时执行一次，动画完全由内部状态机驱动

  return (
    <>
      {/* Canvas 通过 Portal 挂到 document.body，真正覆盖整个视口含导航栏 */}
      {createPortal(
        <canvas
          ref={canvasRef}
          style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100vw', height: '100vh',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />,
        document.body
      )}
      {/* 占位区域（保持布局） */}
      <div className="flex flex-col items-center justify-center py-16" style={{ minHeight: 240 }}>
        <div className="text-[14px] text-amber-600/60 animate-pulse font-medium">
          {progressMsg || '正在解析...'}
        </div>
      </div>
    </>
  );
};

export default GiftBoxAnimation;
