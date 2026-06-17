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
      <GenerationPhaseStack events={$generationEvents} />
    </div>
  </div>
{/if}

<style>
  .animate-spin-slow {
    animation: spin 3s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
