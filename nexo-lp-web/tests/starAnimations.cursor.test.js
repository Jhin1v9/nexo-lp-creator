import { initCursorFollowers, updateCursorFollowers, boomAt } from '../src/lib/starAnimations.js';

describe('cursor follower physics', () => {
  it('picks followers from near and mid layers', () => {
    const near = Array.from({ length: 5 }, (_, i) => createBgStar('near', i));
    const mid = Array.from({ length: 10 }, (_, i) => createBgStar('mid', i));
    const followers = initCursorFollowers([...near, ...mid], 8);
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
    updateCursorFollowers([star], mouse, 1000, 800, true, 0);
    expect(star.nx).toBeGreaterThan(0.1);
    expect(star.ny).toBeGreaterThan(0.1);
  });

  it('does not move followers when mouse is inactive', () => {
    const star = createBgStar('near', 0);
    star.nx = 0.5;
    star.ny = 0.5;
    const mouse = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0 };
    updateCursorFollowers([star], mouse, 1000, 800, false, 0);
    expect(star.nx).toBeCloseTo(0.5, 5);
    expect(star.ny).toBeCloseTo(0.5, 5);
  });

  it('limits follower speed', () => {
    const star = createBgStar('near', 0);
    star.nx = 0.1;
    star.ny = 0.1;
    star.mass = 0.1;
    const mouse = { x: 900, y: 700, vx: 0, vy: 0, lastX: 100, lastY: 100 };
    updateCursorFollowers([star], mouse, 1000, 800, true, 0);
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
