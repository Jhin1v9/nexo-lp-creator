<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  const dispatch = createEventDispatcher();

  const suggestedPrompts = [
    {
      icon: '🚀',
      title: 'SaaS Landing Page',
      description: 'Create a modern SaaS landing page with hero section, pricing, and features',
      prompt: 'Create a modern SaaS landing page with a hero section, pricing table, feature grid, and testimonials. Use a clean, professional design with blue and white colors.',
      gradient: 'from-blue-500/10 to-indigo-500/10',
      border: 'hover:border-blue-300',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      icon: '🏥',
      title: 'Clinic Website',
      description: 'Build a professional medical clinic website with booking and services',
      prompt: 'Build a modern dental clinic website with a welcoming hero section, services overview, doctor profiles, appointment booking form, and contact information. Use calming blue and green tones.',
      gradient: 'from-emerald-500/10 to-teal-500/10',
      border: 'hover:border-emerald-300',
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    {
      icon: '📚',
      title: 'Course Landing Page',
      description: 'Design an online course page with curriculum and instructor info',
      prompt: 'Design an online course landing page with a compelling hero, course curriculum, instructor bio, student testimonials, and enrollment CTA. Use warm, inviting colors.',
      gradient: 'from-amber-500/10 to-orange-500/10',
      border: 'hover:border-amber-300',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    {
      icon: '📱',
      title: 'App Showcase',
      description: 'Create a mobile app landing page with screenshots and download CTA',
      prompt: 'Create a mobile app showcase landing page with app screenshots, feature highlights, download buttons for App Store and Google Play, and user reviews. Use a sleek, modern design.',
      gradient: 'from-purple-500/10 to-pink-500/10',
      border: 'hover:border-purple-300',
      iconBg: 'bg-purple-100 text-purple-600',
    },
    {
      icon: '🍔',
      title: 'Restaurant Page',
      description: 'Build a restaurant landing page with menu and reservation form',
      prompt: 'Build a restaurant landing page with a mouth-watering hero image, menu highlights, reservation form, chef introduction, and contact details. Use warm, appetizing colors.',
      gradient: 'from-red-500/10 to-rose-500/10',
      border: 'hover:border-red-300',
      iconBg: 'bg-red-100 text-red-600',
    },
    {
      icon: '💼',
      title: 'Portfolio Website',
      description: 'Design a creative portfolio for a designer or developer',
      prompt: 'Design a creative portfolio website for a UX designer with project showcase, about section, skills, and contact form. Use a minimalist, elegant design with subtle animations.',
      gradient: 'from-cyan-500/10 to-sky-500/10',
      border: 'hover:border-cyan-300',
      iconBg: 'bg-cyan-100 text-cyan-600',
    },
  ];

  const tips = [
    'Be specific about colors, layout, and sections you want',
    'Mention your target audience for better results',
    'You can ask for revisions anytime - just describe the changes',
    'Add features like contact forms, galleries, or pricing tables',
  ];

  function handleCardClick(prompt) {
    dispatch('select', prompt);
  }
</script>

<div class="flex flex-col items-center justify-center min-h-full py-8 px-4" in:fade={{ duration: 400 }}>
  <!-- Logo & Title -->
  <div class="text-center mb-10 space-y-4" in:fly={{ y: 20, duration: 500, delay: 100 }}>
    <!-- Animated Logo -->
    <div class="relative inline-flex items-center justify-center w-20 h-20 mb-2">
      <div class="absolute inset-0 rounded-2xl bg-gradient-to-br from-luna-primary/20 to-luna-purple/20 animate-pulse-ring"></div>
      <div class="absolute inset-2 rounded-xl bg-gradient-to-br from-luna-primary/30 to-luna-purple/30 animate-pulse-ring" style="animation-delay: 0.5s;"></div>
      <div class="relative w-14 h-14 rounded-xl bg-gradient-to-br from-luna-primary to-luna-purple flex items-center justify-center shadow-glow">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      </div>
    </div>

    <h1 class="text-3xl font-bold gradient-text-animated tracking-tight">
      NEXO Landing Page Creator
    </h1>
    <p class="text-luna-text-muted text-sm max-w-md mx-auto leading-relaxed">
      Hi! I'm <span class="font-semibold text-luna-primary">Luna</span>, your AI landing page designer.
      <br />Describe what you want, and I'll build it for you.
    </p>
  </div>

  <!-- Suggested Prompts Grid -->
  <div class="w-full max-w-3xl mx-auto mb-10">
    <p class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider mb-4 text-center" in:fly={{ y: 10, duration: 400, delay: 200 }}>
      Start with a template
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" in:fly={{ y: 15, duration: 400, delay: 300 }}>
      {#each suggestedPrompts as card, i}
        <button
          class="group text-left p-4 rounded-xl border border-luna-border bg-white card-hover transition-all duration-250 {card.border}"
          on:click={() => handleCardClick(card.prompt)}
          in:fly={{ y: 15, duration: 300, delay: 350 + i * 60 }}
        >
          <div class="flex items-start gap-3">
            <span class="flex-shrink-0 w-10 h-10 rounded-lg {card.iconBg} flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              {card.icon}
            </span>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-semibold text-luna-text group-hover:text-luna-primary transition-colors">
                {card.title}
              </h3>
              <p class="text-xs text-luna-text-muted mt-1 line-clamp-2 leading-relaxed">
                {card.description}
              </p>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Quick Tips -->
  <div class="w-full max-w-lg mx-auto" in:fly={{ y: 10, duration: 400, delay: 700 }}>
    <div class="bg-gradient-to-br from-luna-surface to-white rounded-xl border border-luna-border p-4 space-y-3">
      <div class="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-luna-primary"><path d="M12 2a8 8 0 0 0-8 8c0 3.866 2.582 6.642 4.96 8.12A3 3 0 0 1 12 22a3 3 0 0 1 3.04-3.88C17.418 16.642 20 13.866 20 10a8 8 0 0 0-8-8Z"/><path d="M12 14v4"/><path d="M12 6v4"/></svg>
        <span class="text-xs font-semibold text-luna-text">Pro Tips</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {#each tips as tip, i}
          <div class="flex items-start gap-2 text-xs text-luna-text-secondary">
            <span class="flex-shrink-0 w-4 h-4 rounded-full bg-luna-primary/10 text-luna-primary flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
            <span class="leading-relaxed">{tip}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Footer hint -->
  <p class="text-center text-xs text-luna-text-muted mt-8" in:fade={{ duration: 400, delay: 900 }}>
    Type your idea below or pick a template above to get started
  </p>
</div>
