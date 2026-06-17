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
