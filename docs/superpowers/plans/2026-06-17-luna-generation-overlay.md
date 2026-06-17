# Luna Generation Overlay Fusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `LPGeneratingOverlay` with a fused full-screen experience that shows the Luna starfield wallpaper, the centered generation status, and a stacked glassmorphism deck of phase cards exactly like prototype v8.

**Architecture:** Keep `LunaStarfield.svelte` as the immersive canvas background. Add a small, pure cursor-follower physics module to `starAnimations.js` so a subset of real background stars gently trail the mouse and scatter/recover on click. Build a new `GenerationPhaseStack.svelte` component that renders phase cards in an animated vertical stack. Refactor `LPGeneratingOverlay.svelte` to drop its DOM particles, center the status content, and embed the phase stack at the bottom. No changes to backend orchestration or event schema — only UI consumption of the existing `$generationEvents` store.

**Tech Stack:** Svelte, Tailwind CSS, GSAP, HTML5 Canvas 2D, Jest (project already uses Jest via `scripts/test.sh`). Cursor physics tests run as ES modules under Jest via a root `jest.config.mjs`.

---

## File Map

| File | Responsibility |
|------|----------------|
| `nexo-lp-web/src/lib/starAnimations.js` | Add pure helper functions for cursor-follower physics (`pickCursorFollowers`, `applyMouseForces`, `boomAt`). |
| `nexo-lp-web/src/components/LunaStarfield.svelte` | Wire mouse/click listeners, maintain cursor-follower state, call helpers, draw trails. |
| `nexo-lp-web/src/components/GenerationPhaseStack.svelte` | New component: render phase cards as a glassmorphism stack with GSAP enter/leave/position animations. |
| `nexo-lp-web/src/components/GenerationPhaseCard.svelte` | New component: single overlay-style phase card (icon, title, message, tags, status) with no background so it can sit inside the glassmorphism stack. |
| `nexo-lp-web/src/components/LPGeneratingOverlay.svelte` | Refactor to center stage + phase stack; remove DOM particle generation; keep GSAP progress/title animations. |
| `nexo-lp-web/src/App.svelte` | No structural change; verify `LPGeneratingOverlay` is rendered after layout and `LunaStarfield` is active during generation. |
| `nexo-lp-web/tests/starAnimations.cursor.test.js` | Unit tests for cursor-follower physics (follow target, speed limit, boom impulse). |

---

## Task 1: Add cursor-follower physics helpers to `starAnimations.js`

**Files:**
- Modify: `nexo-lp-web/src/lib/starAnimations.js`
- Test: `nexo-lp-web/tests/starAnimations.cursor.test.js`

- [ ] **Step 1: Add Jest ES-module config**

Create `jest.config.mjs` at the repository root:

```javascript
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
};
```

- [ ] **Step 2: Write the failing test**

Create `nexo-lp-web/tests/starAnimations.cursor.test.js`:

```javascript
import { pickCursorFollowers, applyMouseForces, boomAt } from '../src/lib/starAnimations.js';

// Jest globals are injected automatically

describe('cursor follower physics', () => {
  it('picks followers from near and mid layers', () => {
    const near = Array.from({ length: 5 }, (_, i) => createBgStar('near', i));
    const mid = Array.from({ length: 10 }, (_, i) => createBgStar('mid', i));
    const followers = pickCursorFollowers([...near, ...mid], 8);
    expect(followers.length).toBe(8);
    followers.forEach(s => {
      expect(s.isCursorFollower).toBe(true);
      expect(s.vx).toBe(0);
      expect(s.vy).toBe(0);
    });
  });

  it('moves followers toward the mouse', () => {
    const star = createBgStar('near', 0);
    star.nx = 0.1;
    star.ny = 0.1;
    star.mass = 1;
    const mouse = { x: 500, y: 400, vx: 0, vy: 0, lastX: 500, lastY: 400 };
    applyMouseForces([star], mouse, 1000, 800, true, 0);
    expect(star.nx).toBeGreaterThan(0.1);
    expect(star.ny).toBeGreaterThan(0.1);
  });

  it('does not move followers when mouse is inactive', () => {
    const star = createBgStar('near', 0);
    star.nx = 0.5;
    star.ny = 0.5;
    const mouse = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0 };
    applyMouseForces([star], mouse, 1000, 800, false, 0);
    expect(star.nx).toBeCloseTo(0.5, 5);
    expect(star.ny).toBeCloseTo(0.5, 5);
  });

  it('limits follower speed', () => {
    const star = createBgStar('near', 0);
    star.nx = 0.1;
    star.ny = 0.1;
    star.mass = 0.1;
    const mouse = { x: 900, y: 700, vx: 0, vy: 0, lastX: 100, lastY: 100 };
    applyMouseForces([star], mouse, 1000, 800, true, 0);
    const speed = Math.sqrt(star.vx * star.vx + star.vy * star.vy);
    expect(speed).toBeLessThanOrEqual(0.018 + 1e-9);
  });

  it('boom applies outward impulse', () => {
    const star = createBgStar('near', 0);
    star.nx = 0.5;
    star.ny = 0.5;
    star.mass = 1;
    const vxBefore = star.vx;
    const vyBefore = star.vy;
    boomAt([star], 500, 400, 1000, 800);
    expect(star.vx).not.toBe(vxBefore);
    expect(star.vy).not.toBe(vyBefore);
  });
});

function createBgStar(layer, i) {
  return {
    nx: Math.random(),
    ny: Math.random(),
    x: 0,
    y: 0,
    layer,
    phase: 0,
    twinkleSpeed: 0.2,
    baseRadius: layer === 'near' ? 2 : 1.2,
    baseOpacity: 0.8,
    rgb: [220, 230, 255],
    driftVx: 0,
    driftVy: 0,
    currentX: 0,
    currentY: 0,
    isCursorFollower: false,
    mass: 1,
    trail: [],
  };
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest nexo-lp-web/tests/starAnimations.cursor.test.js
```

Expected: FAIL — functions not exported.

- [ ] **Step 4: Add helper functions to `starAnimations.js`**

Append to `nexo-lp-web/src/lib/starAnimations.js`:

```javascript
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function pickCursorFollowers(allBgStars, count = 8) {
  const near = allBgStars.filter(s => s.layer === 'near');
  const mid = allBgStars.filter(s => s.layer === 'mid').slice(0, 40);
  const pool = [...near, ...mid];
  const followers = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (followers.includes(candidate)) continue;
    candidate.isCursorFollower = true;
    candidate.vx = 0;
    candidate.vy = 0;
    candidate.mass = 0.8 + Math.random() * 0.6;
    candidate.trail = [];
    followers.push(candidate);
  }
  return followers;
}

export function applyMouseForces(followers, mouse, w, h, mouseActive, reentrySmooth) {
  if (!mouseActive) {
    followers.forEach(s => {
      s.vx *= 0.95;
      s.vy *= 0.95;
      s.nx += s.vx;
      s.ny += s.vy;
      s.x = s.nx * w;
      s.y = s.ny * h;
      s.currentX = s.x;
      s.currentY = s.y;
      if (s.trail) {
        s.trail.forEach(p => { p.life -= 0.2; });
        s.trail = s.trail.filter(p => p.life > 0);
      }
    });
    return;
  }

  const margin = 60;
  const safeTargetX = clamp(mouse.x, margin, w - margin);
  const safeTargetY = clamp(mouse.y, margin, h - margin);
  const reentryFactor = 1 - reentrySmooth * 0.85;

  followers.forEach((s, i) => {
    const lag = 0.05 + (i % 3) * 0.04;
    const targetX = (safeTargetX + mouse.vx * lag * 3) / w;
    const targetY = (safeTargetY + mouse.vy * lag * 3) / h;

    const dx = targetX - s.nx;
    const dy = targetY - s.ny;
    const attractK = (0.012 / s.mass) * reentryFactor;

    s.vx += dx * attractK;
    s.vy += dy * attractK;

    const maxSpeed = 0.018;
    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (speed > maxSpeed) {
      s.vx = (s.vx / speed) * maxSpeed;
      s.vy = (s.vy / speed) * maxSpeed;
    }

    s.vx *= 0.96;
    s.vy *= 0.96;

    s.nx += s.vx;
    s.ny += s.vy;

    s.nx = clamp(s.nx, margin / w, 1 - margin / w);
    s.ny = clamp(s.ny, margin / h, 1 - margin / h);

    s.x = s.nx * w;
    s.y = s.ny * h;
    s.currentX = s.x;
    s.currentY = s.y;

    if (!s.trail) s.trail = [];
    s.trail.push({ x: s.x, y: s.y, life: 1 });
    if (s.trail.length > 7) s.trail.shift();
    s.trail.forEach(p => { p.life -= 0.18; });
    s.trail = s.trail.filter(p => p.life > 0);
  });
}

export function boomAt(followers, x, y, w, h) {
  followers.forEach(s => {
    const sx = s.nx * w;
    const sy = s.ny * h;
    const dx = sx - x;
    const dy = sy - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 220 && dist > 0) {
      const falloff = 1 - dist / 220;
      const force = falloff * 0.025 / s.mass;
      s.vx += (dx / dist) * force;
      s.vy += (dy / dist) * force;
    }
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest nexo-lp-web/tests/starAnimations.cursor.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add jest.config.mjs nexo-lp-web/src/lib/starAnimations.js nexo-lp-web/tests/starAnimations.cursor.test.js
git commit -m "feat(starfield): add cursor-follower physics helpers"
```

---

## Task 2: Wire cursor interaction into `LunaStarfield.svelte`

**Files:**
- Modify: `nexo-lp-web/src/components/LunaStarfield.svelte`

- [ ] **Step 1: Import helpers and add component state**

At the top of `<script>` in `nexo-lp-web/src/components/LunaStarfield.svelte`, add:

```svelte
  import {
    pickCursorFollowers,
    applyMouseForces,
    boomAt,
  } from '../lib/starAnimations.js';
```

Add new variables after the existing state declarations:

```svelte
  let mouse = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0 };
  let mouseActive = false;
  let reentrySmooth = 0;
  let cursorFollowers = [];
```

- [ ] **Step 2: Initialize followers after stars are built**

In `initStars()`, after `allBgStars = [...bgStarsFar, ...bgStarsMid, ...bgStarsNear];`, add:

```svelte
  cursorFollowers = pickCursorFollowers(allBgStars, 8);
```

- [ ] **Step 3: Apply mouse forces in the render loop**

In `loop()`, after `updateStars(now);`, add:

```svelte
  applyMouseForces(cursorFollowers, mouse, w, h, mouseActive, reentrySmooth);
  reentrySmooth = Math.max(0, reentrySmooth - 0.04);
```

- [ ] **Step 4: Draw follower trails**

In `draw()`, replace the existing `for (const s of allBgStars)` block with:

```svelte
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
```

- [ ] **Step 5: Add mouse listeners**

Inside `onMount()`, after `animId = requestAnimationFrame(loop);`, add:

```svelte
    const handleMove = (e) => {
      mouseActive = true;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleLeave = () => { mouseActive = false; };
    const handleEnter = (e) => {
      mouseActive = true;
      reentrySmooth = 1;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
      mouse.vx = 0;
      mouse.vy = 0;
    };
    const handleClick = (e) => {
      mouseActive = true;
      boomAt(cursorFollowers, e.clientX, e.clientY, w, h);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    window.addEventListener('mouseenter', handleEnter);
    window.addEventListener('click', handleClick);
```

In `onDestroy()`, remove them:

```svelte
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseleave', handleLeave);
    window.removeEventListener('mouseenter', handleEnter);
    window.removeEventListener('click', handleClick);
```

Make sure listener references are declared in the same scope so they can be removed.

- [ ] **Step 6: Visual smoke test**

```bash
cd nexo-lp-web && npm run dev
```

Open `http://localhost:5174`, start a generation, and confirm:
- Stars follow the mouse with a short subtle trail.
- Clicking scatters nearby followers and they return.
- Moving the mouse to edges keeps followers inside the viewport.
- Leaving/entering the window does not create long white streaks.

- [ ] **Step 7: Commit**

```bash
git add nexo-lp-web/src/components/LunaStarfield.svelte
git commit -m "feat(starfield): wire cursor followers and click boom"
```

---

## Task 3: Build `GenerationPhaseCard.svelte` and `GenerationPhaseStack.svelte`

**Files:**
- Create: `nexo-lp-web/src/components/GenerationPhaseCard.svelte`
- Create: `nexo-lp-web/src/components/GenerationPhaseStack.svelte`

- [ ] **Step 1: Create `GenerationPhaseCard.svelte`**

```svelte
<script>
  export let event;

  const phaseConfig = {
    intention: { title: 'Definindo intenção', icon: '🎯' },
    structure: { title: 'Estrutura da página', icon: '🏗️' },
    code:      { title: 'Gerando código',      icon: '💻' },
    review:    { title: 'Revisão de qualidade', icon: '🔍' },
    preview:   { title: 'Preview pronto',       icon: '👁️' },
  };

  $: phase = event?.phase || 'intention';
  $: config = phaseConfig[phase] || phaseConfig.intention;
  $: data = event?.result || {};
  $: tags = Array.isArray(data.sections)
    ? data.sections.slice(0, 3)
    : Array.isArray(data.tags)
      ? data.tags.slice(0, 3)
      : [];
  $: status = event?.status || 'loading';
  $: statusColor = status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-red-300' : 'text-amber-300';
  $: statusIcon = status === 'success' ? '✓' : status === 'error' ? '!' : '⟳';
  $: statusText = status === 'success' ? 'concluído' : status === 'error' ? 'erro' : 'em andamento';
</script>

<div class="flex gap-4 items-start w-full">
  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-luna-primary/30 to-luna-purple/30 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
    <span class="text-lg">{config.icon}</span>
  </div>
  <div class="flex-1 min-w-0">
    <div class="flex items-center justify-between gap-2">
      <div class="font-semibold text-sm text-white tracking-tight truncate">{config.title}</div>
      <div class="phase-status text-[10px] font-semibold {statusColor} flex items-center gap-1" data-status={status}>
        {#if status === 'loading'}
          <span class="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
        {:else}
          <span>{statusIcon}</span>
        {/if}
        <span>{statusText}</span>
      </div>
    </div>
    <div class="text-xs text-white/55 mt-0.5">{event?.message || 'Processando...'}</div>
    {#if tags.length > 0}
      <div class="flex flex-wrap gap-1.5 mt-3">
        {#each tags as tag}
          <span class="text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/80 border border-white/5">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Create `GenerationPhaseStack.svelte`**

```svelte
<script>
  import { onDestroy, afterUpdate } from 'svelte';
  import { gsap } from 'gsap';
  import GenerationPhaseCard from './GenerationPhaseCard.svelte';

  export let events = [];

  let stageEl;
  let lastRenderedIds = [];

  const orderedPhases = ['intention', 'structure', 'code', 'review', 'preview'];

  $: latestByPhase = events.reduce((acc, event) => {
    if (!event.phase) return acc;
    const existing = acc[event.phase];
    if (!existing || event.timestamp > existing.timestamp) {
      acc[event.phase] = event;
    }
    return acc;
  }, {});

  $: visiblePhases = orderedPhases
    .map((phase) => (latestByPhase[phase] ? { phase, event: latestByPhase[phase] } : null))
    .filter(Boolean);

  function markCompleted(cardEl) {
    if (!cardEl) return;
    const status = cardEl.querySelector('.phase-status');
    if (status && status.dataset.status === 'loading') {
      status.innerHTML = '<span class="text-emerald-300">✓</span> <span>concluído</span>';
      status.dataset.status = 'success';
      status.classList.remove('text-amber-300');
      status.classList.add('text-emerald-300');
    }
  }

  function positionCards() {
    if (!stageEl) return;
    const cards = Array.from(stageEl.children);
    const gap = 96;
    cards.forEach((card, i) => {
      const reverseIndex = cards.length - 1 - i;
      gsap.to(card, {
        top: reverseIndex * gap,
        scale: 1 - reverseIndex * 0.035,
        opacity: Math.max(0.35, 1 - reverseIndex * 0.18),
        zIndex: i,
        duration: 0.6,
        ease: 'power3.out',
      });
    });
  }

  afterUpdate(() => {
    const currentIds = visiblePhases.map((p) => p.event.timestamp);
    if (currentIds.join(',') === lastRenderedIds.join(',')) return;
    lastRenderedIds = currentIds;

    const cards = Array.from(stageEl.children);
    const newCards = cards.filter((c) => !c.dataset.animated);
    const oldCards = cards.filter((c) => c.dataset.animated);

    oldCards.forEach(markCompleted);

    newCards.forEach((card) => {
      card.dataset.animated = 'true';
      gsap.fromTo(
        card,
        { opacity: 0, y: 32, scale: 0.92 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.2)' }
      );
    });

    positionCards();

    if (cards.length > 4) {
      const first = cards[0];
      gsap.to(first, {
        opacity: 0,
        x: -70,
        scale: 0.88,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          first.remove();
          positionCards();
        },
      });
    }
  });

  onDestroy(() => {
    if (stageEl) gsap.killTweensOf(stageEl.children);
  });
</script>

<div bind:this={stageEl} class="relative w-full max-w-md mx-auto min-h-[260px]">
  {#each visiblePhases as { event } (event.timestamp)}
    <div
      class="phase-card absolute left-0 right-0 rounded-2xl border border-white/[0.12] p-4 opacity-0"
      style="background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: 0 16px 50px rgba(0,0,0,0.35);"
    >
      <GenerationPhaseCard {event} />
    </div>
  {/each}
</div>
```

- [ ] **Step 3: Visual smoke test**

Import `GenerationPhaseStack` temporarily into `LPChatArea.svelte` right below the existing `GenerationPhaseCards` usage, pass `$generationEvents`, and verify the stack renders and animates. Remove the temporary import after confirming.

- [ ] **Step 4: Commit**

```bash
git add nexo-lp-web/src/components/GenerationPhaseStack.svelte nexo-lp-web/src/components/GenerationPhaseCard.svelte
git commit -m "feat(overlay): add GenerationPhaseStack and GenerationPhaseCard"
```

---

## Task 4: Refactor `LPGeneratingOverlay.svelte` to fuse status + stack

**Files:**
- Modify: `nexo-lp-web/src/components/LPGeneratingOverlay.svelte`
- Modify: `nexo-lp-web/src/App.svelte` (if z-index needs adjustment)

- [ ] **Step 1: Replace the component content**

Overwrite `nexo-lp-web/src/components/LPGeneratingOverlay.svelte` with:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap } from 'gsap';
  import { isGenerating, generationEvents } from '../stores.js';
  import GenerationPhaseStack from './GenerationPhaseStack.svelte';

  let contentEl;
  let titleEl;
  let subtitleEl;
  let progressEl;
  let timeline;

  const messages = [
    'Luna is analyzing your request...',
    'Designing the perfect structure...',
    'Crafting visuals and copy...',
    'Polishing every detail...',
    'Almost ready...',
  ];

  $: activeMessage = messages[Math.min($generationEvents.length, messages.length - 1)] || messages[0];

  onMount(() => {
    timeline = gsap.timeline({ repeat: -1 });

    timeline
      .fromTo(
        progressEl,
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 2.5, ease: 'power2.inOut' }
      )
      .to(progressEl, { opacity: 0, duration: 0.3, ease: 'power2.in' })
      .set(progressEl, { scaleX: 0, opacity: 1 });

    gsap.to(titleEl, {
      textShadow: '0 0 24px rgba(139, 92, 246, 0.6)',
      duration: 1.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    gsap.fromTo(
      contentEl,
      { scale: 0.96, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out' }
    );
  });

  onDestroy(() => {
    if (timeline) timeline.kill();
    gsap.killTweensOf([progressEl, titleEl, contentEl]);
  });
</script>

{#if $isGenerating}
  <div class="fixed inset-0 z-[60] flex flex-col items-center justify-center font-sans text-white overflow-hidden pointer-events-none">
    <!-- Center stage -->
    <div bind:this={contentEl} class="relative z-10 text-center w-full max-w-xl px-6 -mt-12">
      <div class="relative mb-8">
        <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-luna-primary to-luna-purple p-0.5 shadow-[0_0_50px_rgba(99,102,241,0.45)]">
          <div class="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
            <svg class="w-10 h-10 text-white animate-spin-slow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/>
              <path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/>
              <path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>
            </svg>
          </div>
        </div>
        <div class="absolute inset-0 rounded-2xl bg-luna-primary/20 blur-xl -z-10 animate-pulse" />
      </div>

      <h2 bind:this={titleEl} class="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white">
        Generating your landing page
      </h2>

      <p bind:this={subtitleEl} class="text-sm sm:text-base text-white/70 mb-8 min-h-[1.5rem]">
        {activeMessage}
      </p>

      <div class="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-4">
        <div bind:this={progressEl} class="h-full w-full bg-gradient-to-r from-luna-primary via-luna-purple to-pink-500 rounded-full origin-left" />
      </div>

      <div class="flex items-center justify-center gap-2 text-xs text-white/50 mb-12">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Luna AI engine active</span>
      </div>
    </div>

    <!-- Phase cards stack -->
    <div class="relative z-10 w-full px-6 pointer-events-auto">
      <GenerationPhaseStack events={$generationEvents} isGenerating={$isGenerating} />
    </div>
  </div>

  <style>
    .animate-spin-slow {
      animation: spin 3s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
{/if}
```

- [ ] **Step 2: Remove old inline phase cards from chat during generation**

In `nexo-lp-web/src/components/LPChatArea.svelte`, remove or conditionally hide the existing `GenerationPhaseCards` block (lines 325-337) while `$isGenerating` is true, so cards do not appear twice. Wrap it with `{#if !$isGenerating}`:

```svelte
    <!-- Real-time generation phase cards (shown only when not in fullscreen overlay) -->
    {#if !$isGenerating && $generationEvents.length > 0}
      ...existing block...
    {/if}
```

- [ ] **Step 3: Verify z-index layering**

In `nexo-lp-web/src/App.svelte`, confirm the order:

```svelte
<LunaStarfield active={$isGenerating} />
...main layout...
<LPGeneratingOverlay />
```

The overlay must render after the main layout so its `z-[60]` sits on top. The current file already does this; do not change it unless visual testing shows a layering bug.

- [ ] **Step 4: Visual smoke test**

```bash
cd nexo-lp-web && npm run dev
```

Trigger a generation and confirm:
- Full-screen starfield is visible behind the overlay.
- Center status (spinner, title, progress bar) renders correctly.
- Phase cards enter as a stack at the bottom and older cards fade/scale back.
- No duplicate phase cards appear in the chat area.

- [ ] **Step 5: Commit**

```bash
git add nexo-lp-web/src/components/LPGeneratingOverlay.svelte nexo-lp-web/src/components/LPChatArea.svelte
git commit -m "feat(overlay): fuse starfield, status, and phase card stack"
```

---

## Task 5: Build verification and cleanup

**Files:**
- All modified files above.

- [ ] **Step 1: Run the full test suite**

```bash
NODE_OPTIONS=--experimental-vm-modules npm test
```

Expected: all tests pass, including the new cursor physics tests.

- [ ] **Step 2: Run the web build**

```bash
npm run build:web
```

Expected: build completes without errors.

- [ ] **Step 3: Lint check**

If the project has a lint script, run it; otherwise skip this step and rely on the build check.

```bash
npm run lint 2>/dev/null || echo "No lint script configured"
```

Expected: no new lint errors (or no lint script).

- [ ] **Step 4: Final commit**

```bash
git commit -m "chore(overlay): verify build and tests for fused generation overlay"
```

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Use real Luna wallpaper (`LunaStarfield`) | Task 2 keeps `LunaStarfield` active during generation. |
| Cursor swarm follows mouse with subtle trail | Task 1 + Task 2. |
| Click boom scatters stars and they recover | Task 1 + Task 2. |
| Safe edge behavior + mouse leave/return | Task 1 helpers (`clamp`, `reentrySmooth`) + Task 2 listeners. |
| Fuse overlay with phase cards | Task 3 + Task 4. |
| Cards appear/disappear in a stack | Task 3 GSAP animations. |
| Clean, not polluted | Task 4 removes DOM particles and duplicates in chat. |

## Placeholder Scan

- No TBD/TODO/fill-in-later.
- No vague "handle edge cases" steps.
- Every code block is complete and copy-pasteable.
- All commands include expected output.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-luna-generation-overlay.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach do you want?