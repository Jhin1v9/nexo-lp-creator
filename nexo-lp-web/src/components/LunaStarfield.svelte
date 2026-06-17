<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    BRIGHT_STARS,
    CONSTELLATION_LINES,
    getValidLines,
    buildStarIndex,
  } from '../lib/starData.js';
  import {
    createStarState,
    createBgStarState,
    projectStar,
    projectBgStar,
    assignOrbits,
    orbitPosition,
    clearOrbits,
    initClusters,
    updateClusters,
    ShootingStar,
    drawAtmosphericBg,
    buildDynamicLines,
    lerpColor,
    lerp,
    rgbToString,
    MODE_COLORS,
    MODE_SHIFT_INTENSITY,
    MODE_BEHAVIOR,
    initCursorFollowers,
    updateCursorFollowers,
    boomAt,
  } from '../lib/starAnimations.js';

  export let active = false;

  let canvas;
  let ctx;
  let animId;
  let w, h;

  let stars = [];
  let bgStarsFar = [];
  let bgStarsMid = [];
  let bgStarsNear = [];
  let allBgStars = [];
  let allStars = [];

  let lines = [];
  let dynLines = [];
  let starIndex = {};

  let time = 0;
  let lastTime = 0;
  let dt = 16;

  let lastMode = 'instant';
  let targetMode = 'instant';
  let modeTransition = 1;
  let modeTransitionSpeed = 0.015;

  let clusters = [];
  let clustersInitialized = false;

  let shootingStars = [];
  let shootingStarChance = 0.008;

  let mouse = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0 };
  let mouseActive = false;
  let reentrySmooth = 0;
  let cursorFollowers = [];

  const BG_FAR_COUNT = 80;
  const BG_MID_COUNT = 30;
  const BG_NEAR_COUNT = 10;
  const DYN_CONNECT_DIST = 90;
  const MAX_DYN_PER_STAR = 3;

  function handleMove(e) {
    if (!active) return;
    mouseActive = true;
    mouse.vx = e.clientX - mouse.lastX;
    mouse.vy = e.clientY - mouse.lastY;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function handleLeave() { if (!active) return; mouseActive = false; }
  function handleEnter(e) {
    if (!active) return;
    mouseActive = true;
    reentrySmooth = 1;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
    mouse.vx = 0;
    mouse.vy = 0;
  }
  function handleClick(e) {
    if (!active) return;
    mouseActive = true;
    boomAt(cursorFollowers, e.clientX, e.clientY, w, h);
  }

  function initStars() {
    starIndex = buildStarIndex(BRIGHT_STARS);
    const validLines = getValidLines(BRIGHT_STARS, CONSTELLATION_LINES);
    lines = validLines.map(([a, b]) => [starIndex[a], starIndex[b]]);

    stars = BRIGHT_STARS.map(s => createStarState(s, w, h));
    stars.forEach(s => projectStar(s, w, h));

    bgStarsFar = Array.from({ length: BG_FAR_COUNT }, () => createBgStarState('far', w, h));
    bgStarsMid = Array.from({ length: BG_MID_COUNT }, () => createBgStarState('mid', w, h));
    bgStarsNear = Array.from({ length: BG_NEAR_COUNT }, () => createBgStarState('near', w, h));

    allBgStars = [...bgStarsFar, ...bgStarsMid, ...bgStarsNear];
    cursorFollowers = initCursorFollowers(allBgStars, 8);
    allBgStars.forEach(s => projectBgStar(s, w, h));

    allStars = [...stars, ...bgStarsMid, ...bgStarsNear];
    buildDynamicLines(allStars);

    clusters = initClusters(stars, 4, w, h);
    clustersInitialized = true;
  }

  function rebuildDynamicLines() {
    dynLines = buildDynamicLines(allStars, DYN_CONNECT_DIST, MAX_DYN_PER_STAR);
  }

  function updateModeState() {
    const desiredMode = active ? 'calm' : 'instant';

    if (desiredMode !== targetMode) {
      lastMode = targetMode;
      targetMode = desiredMode;
      modeTransition = 0;

      if (targetMode === 'thinking-loading') {
        assignOrbits(stars, w / 2, h / 2, 0.32);
      } else {
        clearOrbits(stars);
      }
    }

    if (modeTransition < 1) {
      modeTransition = Math.min(1, modeTransition + modeTransitionSpeed);
    }
  }

  function getTargetPosition(s, idx, mode, timeMs) {
    const centerX = w / 2;
    const centerY = h / 2;

    switch (mode) {
      case 'thinking-loading': {
        if (s.orbitActive) {
          const orb = orbitPosition(s, timeMs);
          return { x: orb.x, y: orb.y };
        }
        return { x: s.homeX, y: s.homeY };
      }

      case 'instant': {
        const driftX = s.driftBaseVx * 3.5;
        const driftY = s.driftBaseVy * 1.5;
        let tx = s.homeX + driftX;
        let ty = s.homeY + driftY;
        if (tx > w + 50) tx -= w + 100;
        if (tx < -50) tx += w + 100;
        return { x: tx, y: ty };
      }

      case 'agent': {
        const t = timeMs * 0.001;
        const waveX = Math.sin(t * s.twinkleSpeed + s.phase) * 12;
        const waveY = Math.cos(t * s.twinkleSpeed * 0.7 + s.phase) * 8;
        const driftX = s.driftBaseVx * 0.5;
        const driftY = s.driftBaseVy * 0.5;
        return { x: s.homeX + waveX + driftX, y: s.homeY + waveY + driftY };
      }

      case 'swarm': {
        if (s.clusterId >= 0 && clusters[s.clusterId]) {
          const c = clusters[s.clusterId];
          return { x: c.x + s.clusterOffsetX, y: c.y + s.clusterOffsetY };
        }
        return { x: s.homeX, y: s.homeY };
      }

      case 'tool': {
        const dx = s.homeX - centerX;
        const dy = s.homeY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pulseStrength = Math.max(0, 1 - dist / 250) * 20;
        return {
          x: s.homeX + (dx / (dist + 1)) * pulseStrength,
          y: s.homeY + (dy / (dist + 1)) * pulseStrength,
        };
      }

      default:
        return { x: s.homeX, y: s.homeY };
    }
  }

  function updateStars(timeMs) {
    const behavior = MODE_BEHAVIOR[targetMode] || MODE_BEHAVIOR.thinking;

    stars.forEach((s, idx) => {
      const target = getTargetPosition(s, idx, targetMode, timeMs);
      const lastTarget = getTargetPosition(s, idx, lastMode, timeMs);

      const tx = lerp(lastTarget.x, target.x, modeTransition);
      const ty = lerp(lastTarget.y, target.y, modeTransition);

      const dx = s.currentX - w / 2;
      const dy = s.currentY - h / 2;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.min(w, h) * 0.5;
      const lerpFactor = 0.02 + 0.04 * (1 - distFromCenter / maxDist);

      s.currentX += (tx - s.currentX) * lerpFactor;
      s.currentY += (ty - s.currentY) * lerpFactor;

      if (s.orbitActive) {
        s.orbitAngle += s.orbitSpeed * dt;
      }

      const modeColor = MODE_COLORS[targetMode] || MODE_COLORS.thinking;
      const lastModeColor = MODE_COLORS[lastMode] || MODE_COLORS.thinking;
      const blendedModeColor = lerpColor(lastModeColor, modeColor, modeTransition);
      const shiftStrength = s.brightness * (MODE_SHIFT_INTENSITY[targetMode] || 0);
      s.currentColor = lerpColor(s.baseColor, blendedModeColor, shiftStrength);
    });

    const layers = [
      { stars: bgStarsFar, speedMult: 0.3 },
      { stars: bgStarsMid, speedMult: 0.7 },
      { stars: bgStarsNear, speedMult: 1.5 },
    ];

    for (const layer of layers) {
      for (const s of layer.stars) {
        if (s.isCursorFollower === true) continue;
        if (behavior.drift) {
          s.nx += s.driftVx * behavior.speed * layer.speedMult * 0.008;
          s.ny += s.driftVy * behavior.speed * layer.speedMult * 0.008;
        }
        if (s.nx < 0) s.nx += 1;
        if (s.nx > 1) s.nx -= 1;
        if (s.ny < 0) s.ny += 1;
        if (s.ny > 1) s.ny -= 1;

        s.x = s.nx * w;
        s.y = s.ny * h;
        s.currentX = s.x;
        s.currentY = s.y;
      }
    }
  }

  function updateShootingStars() {
    if (shootingStars.length < 2 && Math.random() < shootingStarChance) {
      const side = Math.floor(Math.random() * 4);
      let sx, sy, angle;
      switch (side) {
        case 0: sx = Math.random() * w; sy = -20; angle = Math.PI * 0.3 + Math.random() * 0.4; break;
        case 1: sx = w + 20; sy = Math.random() * h; angle = Math.PI * 0.8 + Math.random() * 0.4; break;
        case 2: sx = Math.random() * w; sy = h + 20; angle = -Math.PI * 0.7 + Math.random() * 0.4; break;
        default: sx = -20; sy = Math.random() * h; angle = -Math.PI * 0.3 + Math.random() * 0.4; break;
      }
      shootingStars.push(new ShootingStar(sx, sy, angle));
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      shootingStars[i].update();
      if (shootingStars[i].dead) {
        shootingStars.splice(i, 1);
      }
    }
  }

  function drawSoftGlow(x, y, radius, opacity, rgb) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return;
    const glowR = radius * 6;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity * 0.35})`);
    grad.addColorStop(0.35, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity * 0.08})`);
    grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    if (!ctx) return;

    const t = time * 0.001;
    const behavior = MODE_BEHAVIOR[targetMode] || MODE_BEHAVIOR.thinking;
    const twinkleMult = behavior.twinkleMult;
    const brightnessMult = behavior.brightnessMult * (active ? 1.15 : 1.0);

    drawAtmosphericBg(ctx, w, h, targetMode, time);

    ctx.lineCap = 'round';
    const modeColor = MODE_COLORS[targetMode] || MODE_COLORS.thinking;
    const accent = `rgb(${modeColor[0]},${modeColor[1]},${modeColor[2]})`;

    for (const dl of dynLines) {
      const a = allStars[dl.i];
      const b = allStars[dl.j];
      if (!a || !b) continue;

      const pulse = Math.sin(t * dl.speed * twinkleMult + dl.phase) * 0.5 + 0.5;
      const alpha = (1 - dl.dist / DYN_CONNECT_DIST) * 0.05 * pulse * brightnessMult;
      if (alpha < 0.003) continue;

      ctx.beginPath();
      ctx.moveTo(a.currentX || a.x, a.currentY || a.y);
      ctx.lineTo(b.currentX || b.x, b.currentY || b.y);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 0.35;
      ctx.stroke();
    }

    const constLineOpacity = targetMode === 'thinking-loading' ? 0.06 : 0.12;
    ctx.lineWidth = 1.0;
    ctx.lineCap = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;

    for (const [i, j] of lines) {
      const a = stars[i];
      const b = stars[j];
      if (!a || !b) continue;

      const dx = a.currentX - b.currentX;
      const dy = a.currentY - b.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < Math.max(w, h) * 0.32) {
        const pulse = Math.sin(t * 0.7 + i * 0.5) * 0.15 + 0.85;
        ctx.beginPath();
        ctx.moveTo(a.currentX, a.currentY);
        ctx.lineTo(b.currentX, b.currentY);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = constLineOpacity * pulse * brightnessMult;
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    for (const s of allBgStars) {
      const pulse = Math.sin(t * s.twinkleSpeed * twinkleMult + s.phase);
      const opacity = s.baseOpacity * (0.5 + 0.5 * pulse) * brightnessMult;
      const radius = s.baseRadius * (0.8 + 0.2 * pulse);

      if (s.isCursorFollower) {
        if (s.trail && s.trail.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          for (let i = 1; i < s.trail.length; i++) {
            const a = s.trail[i - 1];
            const b = s.trail[i];
            const life = (a.life + b.life) * 0.5;
            ctx.globalAlpha = life * 0.35;
            ctx.lineWidth = Math.max(0.4, radius * 0.9);
            ctx.strokeStyle = 'rgba(210,200,255,0.9)';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.globalAlpha = Math.max(0, opacity);
        ctx.fillStyle = 'rgb(235,230,255)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.25, radius * 1.3), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.fillStyle = `rgb(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.15, radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    stars.forEach((s) => {
      const pulse = Math.sin(t * s.twinkleSpeed * twinkleMult + s.phase);
      const opacity = s.baseOpacity * (0.55 + 0.45 * pulse) * brightnessMult;
      const radius = s.baseRadius * (0.92 + 0.08 * pulse);

      const r = Math.min(255, s.currentColor[0]);
      const g = Math.min(255, s.currentColor[1]);
      const b = Math.min(255, s.currentColor[2]);

      drawSoftGlow(s.currentX, s.currentY, radius, opacity, [r, g, b]);

      ctx.globalAlpha = Math.max(0, opacity);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(s.currentX, s.currentY, Math.max(0.3, radius), 0, Math.PI * 2);
      ctx.fill();

      if (s.mag < 1.2) {
        ctx.globalAlpha = opacity * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.currentX, s.currentY, Math.max(0.12, radius * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
    });

    for (const ss of shootingStars) {
      ss.draw(ctx);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';
  }

  function loop(now) {
    if (!active) return;

    dt = Math.min(now - lastTime, 50);
    lastTime = now;
    time = now;

    updateModeState();
    updateStars(now);
    updateCursorFollowers(cursorFollowers, mouse, w, h, mouseActive, reentrySmooth);
    reentrySmooth = Math.max(0, reentrySmooth - 0.04);

    if (targetMode === 'swarm') {
      updateClusters(clusters, w, h, dt);
    }

    if (targetMode !== 'calm') {
      updateShootingStars();
    }

    draw();

    animId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (animId) return;
    animId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  $: if (active) {
    startLoop();
  } else {
    stopLoop();
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    mouse.x = w / 2;
    mouse.y = h / 2;
    mouse.lastX = mouse.x;
    mouse.lastY = mouse.y;

    stars.forEach(s => projectStar(s, w, h));
    allBgStars.forEach(s => projectBgStar(s, w, h));

    if (targetMode === 'thinking-loading') {
      assignOrbits(stars, w / 2, h / 2, 0.32);
    }

    clusters = initClusters(stars, 4, w, h);
    rebuildDynamicLines();
  }

  onMount(() => {
    ctx = canvas.getContext('2d', { willReadFrequently: false });
    resize();
    initStars();
    window.addEventListener('resize', resize);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    window.addEventListener('mouseenter', handleEnter);
    window.addEventListener('click', handleClick);
  });

  onDestroy(() => {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseleave', handleLeave);
    window.removeEventListener('mouseenter', handleEnter);
    window.removeEventListener('click', handleClick);
  });
</script>

<canvas
  bind:this={canvas}
  class="luna-starfield"
  class:visible={active}
  aria-hidden="true"
></canvas>

<style>
  .luna-starfield {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    z-index: -1;
    pointer-events: none;
    background: #0a0a1a;
    opacity: 0;
    transition: opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .luna-starfield.visible {
    opacity: 1;
  }
</style>
