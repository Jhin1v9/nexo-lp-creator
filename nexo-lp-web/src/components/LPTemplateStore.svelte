<script>
  import { fade, fly } from 'svelte/transition';
  import { templates, showNotification, currentTemplate } from '../stores.js';
  import * as api from '../api.js';
  import LPTemplateCard from './LPTemplateCard.svelte';
  import LPTemplateModal from './LPTemplateModal.svelte';

  let searchQuery = '';
  let activeCategory = 'all';
  let selectedTemplate = null;
  let showModal = false;
  let loading = false;

  const categories = [
    { id: 'all', label: 'All', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>' },
    { id: 'saas', label: 'SaaS', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>' },
    { id: 'clinic', label: 'Clinic', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
    { id: 'course', label: 'Course', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>' },
    { id: 'app', label: 'App', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>' },
    { id: 'portfolio', label: 'Portfolio', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
    { id: 'restaurant', label: 'Restaurant', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>' },
  ];

  const demoTemplates = [
    {
      id: 'saas-1',
      name: 'SaaS Starter',
      description: 'Clean SaaS landing page with hero, features, pricing, and testimonials sections.',
      category: 'saas',
      tags: ['hero', 'pricing', 'features', 'testimonials'],
      status: 'available',
      rating: 4.8,
      uses: 1234,
      price_stars: 5,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-blue-500 to-indigo-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">SaaS</h1><p>Starter Template</p></div></div>',
    },
    {
      id: 'saas-2',
      name: 'SaaS Pro',
      description: 'Advanced SaaS page with animated hero, comparison table, and FAQ section.',
      category: 'saas',
      tags: ['hero', 'pricing', 'comparison', 'faq'],
      status: 'available',
      rating: 4.9,
      uses: 892,
      price_stars: 10,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-indigo-500 to-purple-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">SaaS Pro</h1><p>Advanced Template</p></div></div>',
    },
    {
      id: 'clinic-1',
      name: 'Medical Pro',
      description: 'Professional medical clinic website with appointment booking and doctor profiles.',
      category: 'clinic',
      tags: ['booking', 'doctors', 'services', 'contact'],
      status: 'available',
      rating: 4.7,
      uses: 567,
      price_stars: 8,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-emerald-500 to-teal-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">Medical Pro</h1><p>Clinic Template</p></div></div>',
    },
    {
      id: 'clinic-2',
      name: 'Dental Care',
      description: 'Welcoming dental clinic page with services, team, and online booking form.',
      category: 'clinic',
      tags: ['services', 'team', 'booking', 'reviews'],
      status: 'available',
      rating: 4.6,
      uses: 445,
      price_stars: 7,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-teal-500 to-cyan-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">Dental Care</h1><p>Dental Template</p></div></div>',
    },
    {
      id: 'course-1',
      name: 'Course Hub',
      description: 'Online course landing page with curriculum, instructor bio, and enrollment CTA.',
      category: 'course',
      tags: ['curriculum', 'instructor', 'enrollment', 'reviews'],
      status: 'available',
      rating: 4.8,
      uses: 723,
      price_stars: 6,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-amber-500 to-orange-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">Course Hub</h1><p>Education Template</p></div></div>',
    },
    {
      id: 'app-1',
      name: 'App Launch',
      description: 'Mobile app showcase with screenshot gallery, feature highlights, and download CTAs.',
      category: 'app',
      tags: ['screenshots', 'features', 'download', 'reviews'],
      status: 'available',
      rating: 4.7,
      uses: 634,
      price_stars: 6,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-purple-500 to-pink-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">App Launch</h1><p>Mobile App Template</p></div></div>',
    },
    {
      id: 'portfolio-1',
      name: 'Creative Folio',
      description: 'Minimalist portfolio for designers and developers with project showcase.',
      category: 'portfolio',
      tags: ['projects', 'about', 'skills', 'contact'],
      status: 'available',
      rating: 4.9,
      uses: 1567,
      price_stars: 4,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-slate-700 to-slate-900',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">Creative Folio</h1><p>Portfolio Template</p></div></div>',
    },
    {
      id: 'restaurant-1',
      name: 'Bistro Page',
      description: 'Elegant restaurant page with menu showcase, reservation form, and gallery.',
      category: 'restaurant',
      tags: ['menu', 'reservation', 'gallery', 'reviews'],
      status: 'available',
      rating: 4.5,
      uses: 389,
      price_stars: 5,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-red-500 to-rose-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">Bistro</h1><p>Restaurant Template</p></div></div>',
    },
    {
      id: 'saas-3',
      name: 'Startup Kit',
      description: 'All-in-one startup landing page with investor pitch, team, and metrics.',
      category: 'saas',
      tags: ['pitch', 'team', 'metrics', 'investors'],
      status: 'available',
      rating: 4.6,
      uses: 312,
      price_stars: 9,
      price_suns: 0,
      price_moons: 0,
      gradient: 'from-violet-500 to-purple-600',
      previewHtml: '<div class="h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white"><div class="text-center"><h1 class="text-2xl font-bold mb-2">Startup Kit</h1><p>Startup Template</p></div></div>',
    },
  ];

  async function fetchTemplates() {
    loading = true;
    try {
      const data = await api.getTemplates({ category: activeCategory, search: searchQuery });
      const backendTemplates = data?.templates || [];
      if (backendTemplates.length > 0) {
        templates.set(backendTemplates);
      } else if ($templates.length === 0) {
        templates.set(demoTemplates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      showNotification('Failed to load templates. Showing demo data.', 'error');
      if ($templates.length === 0) {
        templates.set(demoTemplates);
      }
    } finally {
      loading = false;
    }
  }

  $: if (activeCategory !== undefined || searchQuery !== undefined) {
    fetchTemplates();
  }

  $: filteredTemplates = $templates.filter(t => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  function handleTemplateClick(template) {
    selectedTemplate = template;
    showModal = true;
  }

  function handleUseTemplate(e) {
    const template = e.detail;
    currentTemplate.set({ id: template.id, name: template.name });
    showModal = false;
    showNotification(`Using template: ${template.name}`, 'success');
  }

  function closeModal() {
    showModal = false;
    selectedTemplate = null;
  }
</script>

<div class="flex flex-col h-full bg-luna-surface overflow-hidden">
  <!-- Header -->
  <div class="flex-shrink-0 bg-white border-b border-luna-border px-6 py-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-luna-text">Template Gallery</h2>
        <p class="text-xs text-luna-text-muted mt-0.5">{$templates.length} templates available</p>
      </div>

      <!-- Search -->
      <div class="relative w-full sm:w-72">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 -translate-y-1/2 text-luna-text-muted"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          type="text"
          placeholder="Search templates..."
          bind:value={searchQuery}
          class="w-full pl-10 pr-4 py-2 rounded-xl border border-luna-border bg-luna-surface text-sm text-luna-text placeholder-luna-text-muted input-focus transition-all"
        />
        {#if searchQuery}
          <button
            class="absolute right-3 top-1/2 -translate-y-1/2 text-luna-text-muted hover:text-luna-text"
            on:click={() => searchQuery = ''}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        {/if}
      </div>
    </div>

    <!-- Category Filters -->
    <div class="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
      {#each categories as category}
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200"
          class:bg-luna-primary={activeCategory === category.id}
          class:text-white={activeCategory === category.id}
          class:bg-transparent={activeCategory !== category.id}
          class:text-luna-text-secondary={activeCategory !== category.id}
          class:hover:bg-luna-surface={activeCategory !== category.id}
          on:click={() => activeCategory = category.id}
        >
          <span class="flex items-center justify-center w-3.5 h-3.5">
            {@html category.icon}
          </span>
          {category.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Template Grid -->
  <div class="flex-1 overflow-y-auto px-6 py-6">
    {#if loading}
      <div class="flex flex-col items-center justify-center h-full text-center py-20" in:fade={{ duration: 300 }}>
        <div class="w-12 h-12 rounded-full border-2 border-luna-border border-t-luna-primary animate-spin mb-4"></div>
        <h3 class="text-base font-semibold text-luna-text mb-1">Loading templates...</h3>
        <p class="text-sm text-luna-text-muted">Fetching the latest templates from the studio.</p>
      </div>
    {:else if filteredTemplates.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {#each filteredTemplates as template, i (template.id)}
          <LPTemplateCard
            {template}
            on:click={() => handleTemplateClick(template)}
            delay={i * 60}
          />
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-center py-20" in:fade={{ duration: 300 }}>
        <div class="w-16 h-16 rounded-2xl bg-luna-surface flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-luna-text-muted"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <h3 class="text-base font-semibold text-luna-text mb-1">No templates found</h3>
        <p class="text-sm text-luna-text-muted">Try adjusting your search or category filter.</p>
      </div>
    {/if}
  </div>
</div>

<!-- Template Modal -->
{#if showModal && selectedTemplate}
  <LPTemplateModal
    template={selectedTemplate}
    on:close={closeModal}
    on:use={handleUseTemplate}
  />
{/if}
