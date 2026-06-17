<script>
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let template = {};
  export let delay = 0;

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('click', template);
  }

  function handleUse(e) {
    e.stopPropagation();
    dispatch('use', template);
  }

  function getCategoryLabel(cat) {
    const labels = {
      saas: 'SaaS',
      clinic: 'Clinic',
      course: 'Course',
      app: 'App',
      portfolio: 'Portfolio',
      restaurant: 'Restaurant',
    };
    return labels[cat] || cat;
  }

  function getCategoryColor(cat) {
    const colors = {
      saas: 'bg-blue-100 text-blue-700',
      clinic: 'bg-emerald-100 text-emerald-700',
      course: 'bg-amber-100 text-amber-700',
      app: 'bg-purple-100 text-purple-700',
      portfolio: 'bg-slate-200 text-slate-700',
      restaurant: 'bg-red-100 text-red-700',
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  }

  function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    let stars = '';
    for (let i = 0; i < fullStars; i++) {
      stars += '★';
    }
    if (hasHalf) {
      stars += '½';
    }
    for (let i = 0; i < emptyStars; i++) {
      stars += '☆';
    }
    return stars;
  }

  function getGradient(name = '') {
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-purple-500 to-pink-600',
      'from-red-500 to-rose-600',
      'from-violet-500 to-purple-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'available':
        return { label: 'Available', class: 'bg-emerald-100 text-emerald-700' };
      case 'sanitizing':
        return { label: 'Sanitizing', class: 'bg-amber-100 text-amber-700' };
      case 'failed':
        return { label: 'Failed', class: 'bg-red-100 text-red-700' };
      default:
        return { label: status || 'Unknown', class: 'bg-gray-100 text-gray-700' };
    }
  }

  function formatPrice(t) {
    const parts = [];
    if (t.price_stars > 0) parts.push(`${t.price_stars} ⭐`);
    if (t.price_suns > 0) parts.push(`${t.price_suns} ☀️`);
    if (t.price_moons > 0) parts.push(`${t.price_moons} 🌙`);
    return parts.length > 0 ? parts.join(' ') : 'Free';
  }

  $: gradient = template.gradient || getGradient(template.name);
  $: statusBadge = getStatusBadge(template.status);
  $: isUnavailable = template.status === 'failed';
</script>

<button
  class="group text-left rounded-xl border border-luna-border bg-white overflow-hidden card-hover transition-all duration-250 w-full"
  class:opacity-60={isUnavailable}
  class:cursor-not-allowed={isUnavailable}
  on:click={handleClick}
  in:fly={{ y: 15, duration: 300, delay, easing: quintOut }}
  disabled={isUnavailable}
>
  <!-- Preview Area -->
  <div class="h-36 bg-gradient-to-br {gradient} relative overflow-hidden">
    <!-- Abstract Pattern -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-4 left-4 w-12 h-12 rounded-lg bg-white transform rotate-12"></div>
      <div class="absolute bottom-6 right-6 w-16 h-16 rounded-full bg-white transform -rotate-12"></div>
      <div class="absolute top-1/2 left-1/2 w-8 h-8 rounded bg-white transform -translate-x-1/2 -translate-y-1/2 rotate-45"></div>
    </div>

    <!-- Preview Content -->
    <div class="absolute inset-0 flex items-center justify-center text-white p-4">
      <div class="text-center">
        <h4 class="text-lg font-bold opacity-90">{template.name}</h4>
        <p class="text-xs opacity-70 mt-1">{getCategoryLabel(template.category)}</p>
      </div>
    </div>

    <!-- Status Badge -->
    <div class="absolute top-3 left-3">
      <span class="px-2 py-0.5 rounded-md text-[10px] font-medium {statusBadge.class}">
        {statusBadge.label}
      </span>
    </div>

    <!-- Hover Overlay -->
    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
      <span class="px-3 py-1.5 rounded-lg bg-white/90 text-luna-text text-xs font-medium shadow-sm">
        {isUnavailable ? 'Unavailable' : 'View Details'}
      </span>
    </div>
  </div>

  <!-- Info -->
  <div class="p-4 space-y-2.5">
    <!-- Title & Category -->
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-sm font-semibold text-luna-text group-hover:text-luna-primary transition-colors line-clamp-1">
        {template.name}
      </h3>
      <span class="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium {getCategoryColor(template.category)}">
        {getCategoryLabel(template.category)}
      </span>
    </div>

    <!-- Description -->
    <p class="text-xs text-luna-text-muted line-clamp-2 leading-relaxed">
      {template.description}
    </p>

    <!-- Tags -->
    <div class="flex flex-wrap gap-1">
      {#each template.tags?.slice(0, 3) || [] as tag}
        <span class="px-1.5 py-0.5 rounded bg-luna-surface text-[10px] text-luna-text-muted">{tag}</span>
      {/each}
    </div>

    <!-- Footer: Price & Uses -->
    <div class="flex items-center justify-between pt-2 border-t border-luna-border">
      <span class="text-xs font-medium text-luna-text">{formatPrice(template)}</span>
      <span class="text-[10px] text-luna-text-muted">{(template.usage_count ?? template.uses ?? 0).toLocaleString()} uses</span>
    </div>
  </div>
</button>
