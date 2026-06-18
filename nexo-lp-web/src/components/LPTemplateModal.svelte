<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { currentView, showNotification, session } from '../stores.js';
  import * as api from '../api.js';
  import { lpClient } from '../lib/lpClient.js';
  import { projectNameFromPrompt } from '../lib/projectName.js';

  export let template = {};

  const dispatch = createEventDispatcher();

  let promptState = { unlocked: false, prompt: '', censored: true };
  let loadingPrompt = true;
  let buying = false;
  let using = false;
  let previewMode = 'desktop';

  const previewModes = [
    { id: 'mobile', label: 'Mobile', width: 375, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>' },
    { id: 'tablet', label: 'Tablet', width: 768, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="15" y2="15"/></svg>' },
    { id: 'desktop', label: 'Desktop', width: '100%', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" ry="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>' },
  ];

  function handleClose() {
    dispatch('close');
  }

  async function handleUse() {
    if (template.status !== 'available') return;
    using = true;
    try {
      const result = await api.useTemplate(lpClient.sessionId, template.id, lpClient.userId);
      if (result.current_html) {
        lpClient.currentHtml = result.current_html;
      }

      // Refresh the active session so the original prompt becomes the project name
      const projectName = projectNameFromPrompt(result.initialPrompt, template.name || 'Untitled Project');
      await lpClient.setSession(result.sessionId, projectName);
      session.set({
        id: lpClient.sessionId,
        projectName: lpClient.projectName,
        createdAt: lpClient.messageHistory[0]?.timestamp || Date.now(),
      });

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

  function openFullscreenPreview() {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  function setPreviewMode(mode) {
    previewMode = mode;
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
      saas: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      clinic: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      course: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      app: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      portfolio: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      restaurant: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return colors[cat] || 'bg-gray-500/10 text-gray-300 border-gray-500/20';
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
      html += '<span class="text-gray-500">☆</span>';
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

  $: isPurchasable = template.status === 'available' || template.status === 'unreviewed';
  $: canUse = isPurchasable && !using && !buying;
  $: isUnreviewed = template.status === 'unreviewed';
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
  class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
  on:click={handleBackdrop}
  on:keydown={handleBackdropKeydown}
  role="presentation"
  transition:fade={{ duration: 200 }}
>
  <!-- Modal -->
  <div
    class="relative w-full max-w-6xl max-h-[92vh] bg-slate-900/95 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-labelledby="template-modal-title"
    transition:scale={{ duration: 250, easing: quintOut, start: 0.96 }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/50">
      <div class="flex items-center gap-3 min-w-0">
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold border {getCategoryColor(template.category)}">
          {getCategoryLabel(template.category)}
        </span>
        <div class="min-w-0">
          <h2 id="template-modal-title" class="text-lg sm:text-xl font-bold text-white truncate">{template.name}</h2>
          <p class="text-xs text-slate-400 hidden sm:block truncate">{template.description}</p>
        </div>
      </div>
      <button
        class="ml-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
        on:click={handleClose}
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <!-- Preview -->
        <div class="relative bg-slate-950/50 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col">
          <!-- Preview Toolbar -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-md z-10">
            <div class="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {#each previewModes as mode}
                <button
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all {previewMode === mode.id ? 'bg-luna-primary text-white shadow-lg shadow-luna-primary/25' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
                  on:click={() => setPreviewMode(mode.id)}
                  aria-label="Preview {mode.label}"
                  title="{mode.label}"
                >
                  {@html mode.icon}
                  <span class="hidden sm:inline">{mode.label}</span>
                </button>
              {/each}
            </div>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              on:click={openFullscreenPreview}
              disabled={!previewUrl}
              class:opacity-50={!previewUrl}
              class:cursor-not-allowed={!previewUrl}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
              Open
            </button>
          </div>

          <!-- Preview Viewport -->
          <div class="relative flex-1 min-h-[360px] lg:min-h-[560px] overflow-hidden flex items-start justify-center p-4 sm:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/30 via-slate-950/50 to-slate-950/80">
            {#if template.status === 'sanitizing'}
              <div class="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div class="w-12 h-12 rounded-full border-2 border-white/20 border-t-luna-primary animate-spin mb-4"></div>
                <h3 class="text-lg font-bold">Sanitizing preview...</h3>
                <p class="text-sm text-slate-400 mt-1">This template will be available shortly.</p>
              </div>
            {:else if previewUrl}
              <div
                class="relative transition-all duration-500 ease-out shadow-2xl"
                class:w-full={previewMode === 'desktop'}
                class:h-full={previewMode === 'desktop'}
                class:max-w-[375px]={previewMode === 'mobile'}
                class:max-w-[768px]={previewMode === 'tablet'}
                class:rounded-[2rem]={previewMode === 'mobile'}
                class:rounded-xl={previewMode !== 'mobile'}
                class:border-[8px]={previewMode === 'mobile'}
                class:border-0={previewMode !== 'mobile'}
                class:border-slate-800={previewMode === 'mobile'}
                class:bg-slate-800={previewMode === 'mobile'}
                style="{previewMode !== 'desktop' ? `width: 100%;` : ''}"
              >
                {#if previewMode === 'mobile'}
                  <div class="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-800 rounded-b-xl z-10"></div>
                {/if}
                <button
                  class="group absolute inset-0 w-full h-full text-left z-0"
                  on:click={openFullscreenPreview}
                  aria-label="Open preview in full screen"
                >
                  <iframe
                    src={previewUrl}
                    title="Template Preview"
                    class="w-full h-full min-h-[340px] lg:min-h-[540px] border-0 bg-white {previewMode === 'mobile' ? 'rounded-[1.5rem]' : 'rounded-xl'}"
                    sandbox="allow-scripts allow-same-origin"
                  ></iframe>
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none rounded-xl {previewMode === 'mobile' ? 'rounded-[1.5rem]' : ''}">
                    <div class="px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 text-white text-sm font-medium flex items-center gap-2 shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                      View full screen
                    </div>
                  </div>
                </button>
              </div>
            {:else}
              <div class="flex items-center justify-center text-white bg-gradient-to-br {template.gradient || 'from-slate-800 to-slate-900'} rounded-2xl w-full h-full min-h-[340px]">
                <div class="text-center px-6">
                  <h3 class="text-2xl font-bold">{template.name}</h3>
                  <p class="text-sm text-white/70 mt-2">{getCategoryLabel(template.category)} Template</p>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6 bg-slate-900/50">
          <!-- Title mobile -->
          <div class="lg:hidden">
            <p class="text-sm text-slate-300 leading-relaxed">{template.description}</p>
          </div>

          <!-- Stats Row -->
          <div class="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div class="flex items-center gap-2">
              <span class="text-base">{@html renderStars(template.rating || 0)}</span>
              <span class="text-sm font-semibold text-white">{template.rating || '0.0'}</span>
            </div>
            <div class="w-px h-4 bg-white/10"></div>
            <div class="flex items-center gap-1.5 text-sm text-slate-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {(template.usage_count ?? template.uses ?? 0).toLocaleString()} uses
            </div>
            <div class="w-px h-4 bg-white/10"></div>
            <div class="flex items-center gap-1.5 text-sm text-slate-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
              {formatPrice(template)}
            </div>
          </div>

          <!-- Unreviewed warning -->
          {#if isUnreviewed}
            <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-400 flex-shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              <div>
                <p class="text-sm font-semibold text-rose-300">Template sem revisão de qualidade</p>
                <p class="text-xs text-rose-200/70 mt-0.5">Este template foi publicado sem passar pela revisão completa. Por isso está com 50% de desconto. A revisão pode acontecer a qualquer momento e o preço voltará ao normal.</p>
              </div>
            </div>
          {/if}

          <!-- Metadata grid -->
          {#if metadata.category || metadata.subcategory || metadata.niche || metadata.audience || metadata.difficulty || metadata.style}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {#if metadata.category}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">Category</span>
                  <span class="text-sm text-slate-200 font-medium">{getCategoryLabel(metadata.category)}</span>
                </div>
              {/if}
              {#if metadata.subcategory || template.subcategory}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">Subcategory</span>
                  <span class="text-sm text-slate-200 font-medium">{metadata.subcategory || template.subcategory}</span>
                </div>
              {/if}
              {#if metadata.niche}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">Niche</span>
                  <span class="text-sm text-slate-200 font-medium">{metadata.niche}</span>
                </div>
              {/if}
              {#if metadata.audience}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">Audience</span>
                  <span class="text-sm text-slate-200 font-medium">{metadata.audience}</span>
                </div>
              {/if}
              {#if metadata.difficulty}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">Difficulty</span>
                  <span class="text-sm text-slate-200 font-medium">{formatDifficulty(metadata.difficulty)}</span>
                </div>
              {/if}
              {#if metadata.style}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">Style</span>
                  <span class="text-sm text-slate-200 font-medium capitalize">{metadata.style}</span>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Colors -->
          {#if metadata.colors?.length}
            <div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Colors</span>
              <div class="flex flex-wrap gap-3">
                {#each metadata.colors as color}
                  <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span class="w-6 h-6 rounded-full border border-white/10 shadow-sm" style="background-color: {safeColor(color)};"></span>
                    <span class="text-sm font-medium text-slate-300">{color}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Features -->
          {#if metadata.features?.length}
            <div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Features</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {#each metadata.features as feature}
                  <div class="flex items-start gap-2 text-sm text-slate-300">
                    <svg class="w-4 h-4 text-luna-primary mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    <span>{feature}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Use Cases -->
          {#if metadata.useCases?.length}
            <div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Use Cases</span>
              <div class="flex flex-wrap gap-2">
                {#each metadata.useCases as useCase}
                  <span class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">{useCase}</span>
                {/each}
              </div>
            </div>
          {/if}

          <!-- SEO Keywords -->
          {#if metadata.seoKeywords?.length}
            <div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">SEO Keywords</span>
              <div class="flex flex-wrap gap-2">
                {#each metadata.seoKeywords as keyword}
                  <span class="px-2.5 py-1 rounded-md bg-luna-primary/10 border border-luna-primary/20 text-xs text-luna-primary font-medium">{keyword}</span>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Tags -->
          {#if (template.tags || metadata.tags || []).length}
            <div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Tags</span>
              <div class="flex flex-wrap gap-2">
                {#each template.tags || metadata.tags || [] as tag}
                  <span class="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 font-medium">{tag}</span>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Prompt -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prompt</span>
              {#if !loadingPrompt}
                <span class="text-xs px-2 py-1 rounded-full font-medium {promptState.unlocked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
                  {promptState.unlocked ? 'Unlocked' : 'Locked'}
                </span>
              {/if}
            </div>
            {#if loadingPrompt}
              <div class="h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <div class="w-6 h-6 rounded-full border-2 border-white/10 border-t-luna-primary animate-spin"></div>
              </div>
            {:else}
              <div class="p-4 rounded-xl bg-slate-950/50 border border-white/10 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {promptState.censored ? (template.prompt_censored || '[PROMPT BLOQUEADO...]') : (promptState.prompt || template.prompt_censored || '[No prompt available]')}
              </div>
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <button
              class="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl btn-primary text-white text-sm font-semibold transition-all shadow-lg shadow-luna-primary/25"
              class:opacity-50={!canUse}
              class:cursor-not-allowed={!canUse}
              on:click={handleUse}
              disabled={!canUse}
            >
              {#if using}
                <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                Using...
              {:else if !isPurchasable}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {template.status === 'sanitizing' ? 'Sanitizing...' : 'Unavailable'}
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                Use Template
              {/if}
            </button>
            <button
              class="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-all"
              class:opacity-50={buying || promptState.unlocked || !isPurchasable}
              class:cursor-not-allowed={buying || promptState.unlocked || !isPurchasable}
              on:click={handleBuy}
              disabled={buying || promptState.unlocked || !isPurchasable}
            >
              {#if buying}
                <div class="w-4 h-4 rounded-full border-2 border-slate-400/30 border-t-slate-400 animate-spin"></div>
                Buying...
              {:else if !isPurchasable}
                <span>🛒</span>
                {template.status === 'sanitizing' ? 'Coming soon' : 'Unavailable'}
              {:else if isUnreviewed}
                <span>🛒</span>
                Buy {formatPrice(template)}
              {:else}
                <span>🛒</span>
                Buy {formatPrice(template)}
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
