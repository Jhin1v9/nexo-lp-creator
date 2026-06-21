<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { gsap } from 'gsap';
  import { isGenerating, generationEvents, generationOverlayMinimized } from '../stores.js';
  import GenerationPhaseStack from './GenerationPhaseStack.svelte';
  import LunaStarfield from './LunaStarfield.svelte';

  let contentEl;
  let titleEl;
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

  let wasGenerating = false;
  $: {
    if ($isGenerating && !wasGenerating) {
      generationOverlayMinimized.set(false);
    }
    wasGenerating = $isGenerating;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && !$generationOverlayMinimized) {
      generationOverlayMinimized.set(true);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);

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
    window.removeEventListener('keydown', handleKeydown);
    if (timeline) timeline.kill();
    gsap.killTweensOf([progressEl, titleEl, contentEl]);
  });
</script>

{#if $isGenerating && !$generationOverlayMinimized}
  <div
    aria-busy="true"
    class="fixed inset-0 z-[60] flex flex-col items-center justify-center font-sans text-white overflow-hidden pointer-events-none"
    transition:fade={{ duration: 700 }}
  >
    <!-- Dark backdrop that fades in smoothly -->
    <div
      class="absolute inset-0 bg-black/80 z-0"
      in:fade={{ duration: 700 }}
      out:fade={{ duration: 500 }}
    ></div>

    <!-- Immersive starfield wallpaper behind the generating animation -->
    <LunaStarfield active={true} className="overlay-starfield" />

    <!-- Minimize button -->
    <button
      type="button"
      on:click={() => generationOverlayMinimized.set(true)}
      class="pointer-events-auto absolute top-5 right-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-[11px] text-white/80 backdrop-blur-md transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
      <span>Sair do universo</span>
    </button>

    <!-- Center stage -->
    <div bind:this={contentEl} class="relative z-10 text-center w-full max-w-xl px-6 -mt-12 pointer-events-auto">
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

      <p role="status" aria-live="polite" class="text-sm sm:text-base text-white/70 mb-8 min-h-[1.5rem]">
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

{#if $isGenerating && $generationOverlayMinimized}
  <button
    type="button"
    on:click={() => generationOverlayMinimized.set(false)}
    class="fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-luna-primary to-luna-purple text-white text-sm font-medium shadow-[0_0_30px_rgba(99,102,241,0.45)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] hover:scale-105 transition-all pointer-events-auto"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span>Voltar pro universo LP</span>
  </button>
{/if}

<style>
  .animate-spin-slow {
    animation: spin 3s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  :global(.overlay-starfield) {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 0 !important;
  }
</style>
