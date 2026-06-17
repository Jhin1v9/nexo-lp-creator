/**
 * Frontend currency helpers for the NEXO multi-mode economy.
 */

export const MODES = {
  stars: {
    id: 'stars',
    label: 'Estrelas',
    description: 'Landing pages simples em HTML + Tailwind',
    summary: 'HTML + Tailwind, rápido e barato',
  },
  suns: {
    id: 'suns',
    label: 'Sóis',
    description: 'Apps e frameworks (React, Vue, Next.js)',
    summary: 'React, Vue ou Next.js',
  },
  moons: {
    id: 'moons',
    label: 'Lunas',
    description: 'Apps inteiros com Agent Swarm',
    summary: 'Agent Swarm, apps completos',
  },
};

export const COSTS = {
  generate: {
    stars: { stars: 2, suns: 0, moons: 0 },
    suns: { stars: 0, suns: 1, moons: 0 },
    moons: { stars: 0, suns: 0, moons: 1 },
  },
  rebuild: { stars: 1, suns: 1, moons: 0 },
  publish: { stars: 1, suns: 0, moons: 0 },
  useTemplate: { stars: 0, suns: 0, moons: 0 },
};

export function costFor(operation, mode = 'stars') {
  if (operation === 'generate') {
    return COSTS.generate[mode] || COSTS.generate.stars;
  }
  return COSTS[operation] || { stars: 0, suns: 0, moons: 0 };
}

export function canAfford(balance, cost) {
  return (
    balance.stars >= (cost.stars || 0) &&
    balance.suns >= (cost.suns || 0) &&
    balance.moons >= (cost.moons || 0)
  );
}

export function formatCost(cost) {
  const parts = [];
  if (cost.stars) parts.push(`${cost.stars}⭐`);
  if (cost.suns) parts.push(`${cost.suns}☀️`);
  if (cost.moons) parts.push(`${cost.moons}🌙`);
  return parts.join(' ') || 'grátis';
}
