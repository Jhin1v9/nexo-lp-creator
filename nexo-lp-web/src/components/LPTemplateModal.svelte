<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { currentView, showNotification } from '../stores.js';
  import * as api from '../api.js';
  import { lpClient } from '../lib/lpClient.js';

  export let template = {};

  const dispatch = createEventDispatcher();

  let promptState = { unlocked: false, prompt: '', censored: true };
  let loadingPrompt = true;
  let buying = false;
  let using = false;

  function handleClose() {
    dispatch('close');
  }

  async function handleUse() {
    if (template.status !== 'available') return;
    using = true;
    try {
      const result = await api.useTemplate(lpClient.sessionId, template.id, lpClient.userId);
      if (result.html) {
        lpClient.currentHtml = result.html;
      }
      dispatch('use', template);
      showNotification(`Using template: ${template.name}`, 'success');
      currentView.set('chat');
    } catch (error) {
      console.error('Failed to use template:', error);
      showNotification(error.message || 'Failed to use template', 'error');
    } finally {
      using = false;
    }
  }

  async function handleBuy() {
    buying = true;
    try {
      await api.buyTemplate(template.id, lpClient.userId);
      showNotification('Purchase successful! Prompt unlocked.', 'success');
      await loadPrompt();
    } catch (error) {
      console.error('Failed to buy template:', error);
      showNotification(error.message || 'Failed to purchase template', 'error');
    } finally {
      buying = false;
    }
  }

  async function loadPrompt() {
    loadingPrompt = true;
    try {
      promptState = await api.getTemplatePrompt(template.id, lpClient.userId);
    } catch (error) {
      console.error('Failed to load prompt:', error);
      promptState = { unlocked: false, prompt: template.prompt_censored || '[PROMPT BLOQUEADO...]', censored: true };
    } finally {
      loadingPrompt = false;
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleBackdropKeydown(e) {
    if (e.key === 'Escape') {
      handleClose();
    }
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

    let html = '';
    for (let i = 0; i < fullStars; i++) {
      html += '<span class="text-amber-400">★</span>';
    }
    if (hasHalf) {
      html += '<span class="text-amber-400">½</span>';
    }
    for (let i = 0; i < emptyStars; i++) {
      html += '<span class="text-gray-300">☆</span>';
    }
    return html;
  }

  function formatPrice(t) {
    const parts = [];
    if (t.price_stars > 0) parts.push(`${t.price_stars} ⭐`);
    if (t.price_suns > 0) parts.push(`${t.price_suns} ☀️`);
    if (t.price_moons > 0) parts.push(`${t.price_moons} 🌙`);
    return parts.length > 0 ? parts.join(' ') : 'Free';
  }

  function templateMetadata(t) {
    if (!t?.metadata_json) return {};
    try {
      return JSON.parse(t.metadata_json) || {};
    } catch {
      return {};
    }
  }

  function formatDifficulty(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function isValidColor(color) {
    if (!color || typeof color !== 'string') return false;
    const hex = /^#([0-9A-Fa-f]{3}){1,2}$/;
    const rgb = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const rgba = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/;
    const hsl = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/;
    const hsla = /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*(0|1|0?\.\d+)\s*\)$/;
    return hex.test(color) || rgb.test(color) || rgba.test(color) || hsl.test(color) || hsla.test(color);
  }

  function safeColor(color) {
    return isValidColor(color) ? color : 'transparent';
  }

  $: canUse = template.status === 'available' && !using && !buying;
  $: isAvailable = template.status === 'available';
  $: metadata = templateMetadata(template);
  $: previewUrl = template.public_preview_token
    ? `${window.location.origin}/preview/public/${template.public_preview_token}.html`
    : null;

  onMount(() => {
    loadPrompt();
  });
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
  on:click={handleBackdrop}
  on:keydown={handleBackdropKeydown}
  role="presentation"
  transition:fade={{ duration: 200 }}
>
  <!-- Modal -->
  <div
    class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in"
    role="dialog"
    aria-modal="true"
    aria-labelledby="template-modal-title"
    transition:scale={{ duration: 250, easing: quintOut, start: 0.95 }}
  >
    <!-- Preview Header -->
    <div class="relative bg-luna-surface">
      {#if template.status === 'sanitizing'}
        <div class="h-64 bg-gradient-to-br {template.gradient || 'from-gray-200 to-gray-300'} flex flex-col items-center justify-center text-white">
          <div class="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin mb-3"></div>
          <h2 class="text-lg font-bold">Sanitizing preview...</h2>
          <p class="text-sm opacity-80 mt-1">This template will be available shortly.</p>
        </div>
      {:else if previewUrl}
        <iframe
          src={previewUrl}
          title="Preview"
          class="w-full h-64 border-0"
          sandbox="allow-scripts allow-same-origin"
        ></iframe>
      {:else}
        <div class="h-64 bg-gradient-to-br {template.gradient || 'from-gray-200 to-gray-300'} flex items-center justify-center text-white">
          <div class="text-center">
            <h2 id="template-modal-title" class="text-2xl font-bold">{template.name}</h2>
            <p class="text-sm opacity-80 mt-1">{getCategoryLabel(template.category)} Template</p>
          </div>
        </div>
      {/if}

      <!-- Close Button -->
      <button
        class="absolute top-4 right-4 w-8 h-8 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/30 transition-all flex items-center justify-center"
        on:click={handleClose}
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-6 space-y-5">
      <!-- Description -->
      <div>
        <p class="text-sm text-luna-text leading-relaxed">{template.description}</p>
      </div>

      <!-- Metadata -->
      {#if metadata.category || metadata.subcategory || metadata.niche || metadata.audience || metadata.difficulty || metadata.style || metadata.colors?.length || metadata.features?.length || metadata.useCases?.length || metadata.seoKeywords?.length}
        <div>
          <span class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider mb-2 block">About this template</span>
          <div class="grid grid-cols-2 gap-2 text-xs text-luna-text-secondary">
            {#if metadata.category}
              <div class="flex justify-between gap-2"><span class="text-luna-text-muted">Category</span> <span class="font-medium">{getCategoryLabel(metadata.category)}</span></div>
            {/if}
            {#if metadata.subcategory || template.subcategory}
              <div class="flex justify-between gap-2"><span class="text-luna-text-muted">Subcategory</span> <span class="font-medium">{metadata.subcategory || template.subcategory}</span></div>
            {/if}
            {#if metadata.niche}
              <div class="flex justify-between gap-2"><span class="text-luna-text-muted">Niche</span> <span class="font-medium">{metadata.niche}</span></div>
            {/if}
            {#if metadata.audience}
              <div class="flex justify-between gap-2"><span class="text-luna-text-muted">Audience</span> <span class="font-medium">{metadata.audience}</span></div>
            {/if}
            {#if metadata.difficulty}
              <div class="flex justify-between gap-2"><span class="text-luna-text-muted">Difficulty</span> <span class="font-medium">{formatDifficulty(metadata.difficulty)}</span></div>
            {/if}
            {#if metadata.style}
              <div class="flex justify-between gap-2"><span class="text-luna-text-muted">Style</span> <span class="font-medium capitalize">{metadata.style}</span></div>
            {/if}
          </div>

          {#if metadata.colors?.length}
            <div class="mt-3">
              <span class="text-[10px] font-medium text-luna-text-muted uppercase tracking-wider mb-1.5 block">Colors</span>
              <div class="flex flex-wrap gap-2">
                {#each metadata.colors as color}
                  <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-luna-surface border border-luna-border">
                    <span class="w-4 h-4 rounded-full border border-black/10" style="background-color: {safeColor(color)};"></span>
                    <span class="text-[10px] font-medium text-luna-text-secondary">{color}</span>
              </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if metadata.features?.length}
            <div class="mt-3">
              <span class="text-[10px] font-medium text-luna-text-muted uppercase tracking-wider mb-1.5 block">Features</span>
              <ul class="list-disc list-inside text-xs text-luna-text-secondary space-y-0.5">
                {#each metadata.features as feature}
                  <li>{feature}</li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if metadata.useCases?.length}
            <div class="mt-3">
              <span class="text-[10px] font-medium text-luna-text-muted uppercase tracking-wider mb-1.5 block">Use Cases</span>
              <ul class="list-disc list-inside text-xs text-luna-text-secondary space-y-0.5">
                {#each metadata.useCases as useCase}
                  <li>{useCase}</li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if metadata.seoKeywords?.length}
            <div class="mt-3">
              <span class="text-[10px] font-medium text-luna-text-muted uppercase tracking-wider mb-1.5 block">SEO Keywords</span>
              <div class="flex flex-wrap gap-1.5">
                {#each metadata.seoKeywords as keyword}
                  <span class="px-2 py-0.5 rounded-md bg-luna-surface text-[10px] text-luna-text-secondary border border-luna-border">{keyword}</span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tags -->
      <div>
        <span class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider mb-2 block">Features</span>
        <div class="flex flex-wrap gap-2">
          {#each template.tags || metadata.tags || [] as tag}
            <span class="px-2.5 py-1 rounded-lg bg-luna-surface text-xs text-luna-text-secondary font-medium border border-luna-border">
              {tag}
            </span>
          {/each}
        </div>
      </div>

      <!-- Stats Row -->
      <div class="flex items-center gap-6 py-3 border-y border-luna-border">
        <div class="flex items-center gap-2">
          <span class="text-sm">{@html renderStars(template.rating || 0)}</span>
          <span class="text-sm font-semibold text-luna-text">{template.rating}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-luna-text-muted"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span class="text-sm text-luna-text-muted">{(template.usage_count ?? template.uses ?? 0).toLocaleString()} uses</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-luna-text-muted"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
          <span class="px-2 py-0.5 rounded text-xs font-medium {getCategoryColor(template.category)}">{getCategoryLabel(template.category)}</span>
        </div>
      </div>

      <!-- Prompt Section -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider">Prompt</span>
          {#if !loadingPrompt}
            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium {promptState.unlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
              {promptState.unlocked ? 'Unlocked' : 'Locked'}
            </span>
          {/if}
        </div>
        {#if loadingPrompt}
          <div class="h-16 rounded-xl bg-luna-surface border border-luna-border flex items-center justify-center">
            <div class="w-5 h-5 rounded-full border-2 border-luna-border border-t-luna-primary animate-spin"></div>
          </div>
        {:else}
          <div class="p-3 rounded-xl bg-luna-surface border border-luna-border text-sm text-luna-text-secondary leading-relaxed max-h-40 overflow-y-auto">
            {promptState.censored ? (template.prompt_censored || '[PROMPT BLOQUEADO...]') : (promptState.prompt || template.prompt_censored || '[No prompt available]')}
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-white text-sm font-medium transition-all"
          class:opacity-50={!canUse}
          class:cursor-not-allowed={!canUse}
          on:click={handleUse}
          disabled={!canUse}
        >
          {#if using}
            <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
            Using...
          {:else if !isAvailable}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
            {template.status === 'sanitizing' ? 'Sanitizing...' : 'Unavailable'}
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            Use Template
          {/if}
        </button>
        <button
          class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-luna-border text-sm font-medium text-luna-text-secondary hover:bg-luna-surface transition-all"
          class:opacity-50={buying || promptState.unlocked || !isAvailable}
          class:cursor-not-allowed={buying || promptState.unlocked || !isAvailable}
          on:click={handleBuy}
          disabled={buying || promptState.unlocked || !isAvailable}
        >
          {#if buying}
            <div class="w-4 h-4 rounded-full border-2 border-luna-text-secondary/30 border-t-luna-text-secondary animate-spin"></div>
            Buying...
          {:else if !isAvailable}
            <span>🛒</span>
            {template.status === 'sanitizing' ? 'Coming soon' : 'Unavailable'}
          {:else}
            <span>🛒</span>
            Buy {formatPrice(template)}
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
