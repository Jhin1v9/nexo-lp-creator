<script>
  import { onMount } from 'svelte';
  import { fade, fly, slide, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { preview, bugReport, showNotification } from '../stores.js';
  import { estimateLighthouseScores, getScoreColor, getScoreLabel, getScoreRingColor } from '../lib/lighthouseEstimator.js';

  let isScanning = false;
  let scanProgress = 0;

  const demoIssues = [
    {
      id: 'issue-1',
      severity: 'warning',
      category: 'accessibility',
      title: 'Missing alt attributes on images',
      description: '3 images found without alt text. This impacts screen reader accessibility.',
      fixable: true,
      fix: 'Add descriptive alt attributes to all images',
      line: 42,
    },
    {
      id: 'issue-2',
      severity: 'error',
      category: 'performance',
      title: 'Render-blocking resources detected',
      description: '2 scripts in <head> may block initial page render.',
      fixable: true,
      fix: 'Move non-critical scripts to the end of <body> or use async/defer',
      line: 15,
    },
    {
      id: 'issue-3',
      severity: 'info',
      category: 'seo',
      title: 'Meta description too short',
      description: 'Meta description is only 45 characters. Recommended: 50-160 characters.',
      fixable: true,
      fix: 'Expand meta description to at least 120 characters',
      line: 7,
    },
    {
      id: 'issue-4',
      severity: 'warning',
      category: 'best-practices',
      title: 'Missing Open Graph tags',
      description: 'No og:title or og:description tags found for social sharing.',
      fixable: true,
      fix: 'Add Open Graph meta tags for better social media previews',
      line: 8,
    },
    {
      id: 'issue-5',
      severity: 'error',
      category: 'accessibility',
      title: 'Form inputs missing labels',
      description: '2 form inputs found without associated <label> elements.',
      fixable: true,
      fix: 'Wrap inputs in <label> or use aria-label attributes',
      line: 128,
    },
    {
      id: 'issue-6',
      severity: 'info',
      category: 'seo',
      title: 'Missing canonical URL',
      description: 'No canonical link tag found. This may cause duplicate content issues.',
      fixable: true,
      fix: 'Add <link rel="canonical" href="..."> to <head>',
      line: 6,
    },
    {
      id: 'issue-7',
      severity: 'warning',
      category: 'performance',
      title: 'Large inline CSS detected',
      description: 'Inline styles total 12KB. Consider moving to external stylesheet.',
      fixable: true,
      fix: 'Extract inline CSS to a separate stylesheet file',
      line: 20,
    },
  ];

  $: estimatedScores = $preview.html ? estimateLighthouseScores($preview.html) : null;
  $: issues = $bugReport.issues.length > 0 ? $bugReport.issues : demoIssues;
  $: checked = $bugReport.checked;

  const severityConfig = {
    error: {
      label: 'Error',
      color: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>`,
    },
    warning: {
      label: 'Warning',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    },
    info: {
      label: 'Info',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    },
  };

  const categoryConfig = {
    performance: { label: 'Performance', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>' },
    accessibility: { label: 'Accessibility', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>' },
    'best-practices': { label: 'Best Practices', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z"/></svg>' },
    seo: { label: 'SEO', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' },
  };

  function getSeverityConfig(severity) {
    return severityConfig[severity] || severityConfig.info;
  }

  function getCategoryConfig(category) {
    return categoryConfig[category] || { label: category, icon: '' };
  }

  async function handleScan() {
    if (isScanning) return;

    isScanning = true;
    scanProgress = 0;

    // Simulate scanning progress
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, 200));
      scanProgress = Math.round(((i + 1) / steps) * 100);
    }

    // Set bug report with demo issues
    bugReport.set({
      score: estimatedScores ? estimatedScores.overall : 75,
      issues: demoIssues,
      checked: true,
    });

    isScanning = false;
    showNotification('Bug scan complete!', 'success');
  }

  function handleFixIssue(issue) {
    showNotification(`Fix applied for: ${issue.title}`, 'success');
    // Remove the fixed issue from the list
    bugReport.update(b => ({
      ...b,
      issues: b.issues.filter(i => i.id !== issue.id),
    }));
  }

  function handleFixAll() {
    const fixableCount = issues.filter(i => i.fixable).length;
    showNotification(`Fixed ${fixableCount} issues!`, 'success');
    bugReport.update(b => ({
      ...b,
      issues: b.issues.filter(i => !i.fixable),
    }));
  }

  $: errorCount = issues.filter(i => i.severity === 'error').length;
  $: warningCount = issues.filter(i => i.severity === 'warning').length;
  $: infoCount = issues.filter(i => i.severity === 'info').length;
  $: fixableCount = issues.filter(i => i.fixable).length;

  function getScoreRingSvg(score) {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    return { radius, circumference, offset };
  }
</script>

<div class="flex flex-col h-full bg-white overflow-hidden">
  <!-- Header -->
  <div class="flex-shrink-0 px-6 py-4 border-b border-luna-border">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <!-- Overall Score Ring -->
        {#if estimatedScores}
          <div class="relative w-16 h-16 flex-shrink-0">
            <svg width="64" height="64" viewBox="0 0 64 64" class="transform -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#E2E8F0" stroke-width="5" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke={getScoreColor(estimatedScores.overall)}
                stroke-width="5"
                stroke-dasharray={getScoreRingSvg(estimatedScores.overall).circumference}
                stroke-dashoffset={getScoreRingSvg(estimatedScores.overall).offset}
                stroke-linecap="round"
                class="transition-all duration-1000"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-lg font-bold" style="color: {getScoreColor(estimatedScores.overall)}">{estimatedScores.overall}</span>
            </div>
          </div>
        {/if}

        <div>
          <h2 class="text-lg font-semibold text-luna-text flex items-center gap-2">
            Bug Detector
n            {#if checked}
              <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">Scanned</span>
            {/if}
          </h2>
          <div class="flex items-center gap-3 mt-1">
            <span class="flex items-center gap-1 text-xs text-red-600">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {errorCount} errors
            </span>
            <span class="flex items-center gap-1 text-xs text-amber-600">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {warningCount} warnings
            </span>
            <span class="flex items-center gap-1 text-xs text-blue-600">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              {infoCount} info
            </span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        {#if fixableCount > 0}
          <button
            class="px-4 py-2 rounded-xl border border-luna-border text-sm font-medium text-luna-text-secondary hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center gap-1.5"
            on:click={handleFixAll}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z"/></svg>
            Fix All ({fixableCount})
          </button>
        {/if}
        <button
          class="px-4 py-2 rounded-xl btn-primary text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          on:click={handleScan}
          disabled={isScanning}
        >
          {#if isScanning}
            <svg class="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Scanning... {scanProgress}%
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.3-4.3"/><path d="M11.5 21a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z"/></svg>
            Scan Now
          {/if}
        </button>
      </div>
    </div>

    <!-- Scan Progress Bar -->
    {#if isScanning}
      <div class="mt-3" in:slide={{ duration: 150 }}>
        <div class="w-full bg-luna-surface rounded-full h-1.5 overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r from-luna-primary to-luna-purple transition-all duration-300"
            style="width: {scanProgress}%"
          ></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Category Scores -->
  {#if estimatedScores}
    <div class="flex-shrink-0 grid grid-cols-4 gap-0 border-b border-luna-divide" in:fly={{ y: 5, duration: 200 }}>
      {#each [
        { key: 'performance', label: 'Performance', score: estimatedScores.performance },
        { key: 'accessibility', label: 'Accessibility', score: estimatedScores.accessibility },
        { key: 'bestPractices', label: 'Best Practices', score: estimatedScores.bestPractices },
        { key: 'seo', label: 'SEO', score: estimatedScores.seo },
      ] as cat}
        <div class="px-4 py-3 text-center border-r border-luna-border last:border-r-0">
          <span class="text-[10px] text-luna-text-muted uppercase tracking-wider">{cat.label}</span>
          <div class="text-lg font-bold mt-0.5" style="color: {getScoreColor(cat.score)}">{cat.score}</div>
          <div class="w-full bg-luna-surface rounded-full h-1 mt-1 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-700"
              style="width: {cat.score}%; background-color: {getScoreColor(cat.score)}"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Issues List -->
  <div class="flex-1 overflow-y-auto px-6 py-4">
    <div class="space-y-3">
      {#each issues as issue, i (issue.id)}
        <div
          class="p-4 rounded-xl border border-luna-border bg-white hover:shadow-sm transition-all"
          in:fly={{ y: 8, duration: 250, delay: i * 50 }}
        >
          <div class="flex items-start gap-3">
            <!-- Severity Icon -->
            <div class="flex-shrink-0 w-8 h-8 rounded-lg {getSeverityConfig(issue.severity).color.split(' ')[0]} flex items-center justify-center">
              {@html getSeverityConfig(issue.severity).icon}
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm font-semibold text-luna-text">{issue.title}</h3>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium {getSeverityConfig(issue.severity).color}">
                  {getSeverityConfig(issue.severity).label}
                </span>
                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-luna-surface text-[10px] text-luna-text-muted">
                  <span class="flex items-center justify-center w-3 h-3">
                    {@html getCategoryConfig(issue.category).icon}
                  </span>
                  {getCategoryConfig(issue.category).label}
                </span>
                {#if issue.line}
                  <span class="text-[10px] text-luna-text-muted font-mono">Line {issue.line}</span>
                {/if}
              </div>
              <p class="text-xs text-luna-text-muted mt-1.5 leading-relaxed">{issue.description}</p>

              <!-- Fix Section -->
              {#if issue.fixable && issue.fix}
                <div class="mt-2.5 flex items-center justify-between">
                  <span class="text-xs text-luna-text-secondary italic">{issue.fix}</span>
                  <button
                    class="flex-shrink-0 ml-3 px-3 py-1 rounded-lg text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-1"
                    on:click={() => handleFixIssue(issue)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z"/></svg>
                    Fix
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Empty State -->
    {#if issues.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center" in:fade={{ duration: 300 }}>
        <div class="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z"/></svg>
        </div>
        <h3 class="text-base font-semibold text-luna-text mb-1">All Clear!</h3>
        <p class="text-sm text-luna-text-muted">No issues found. Your landing page looks great.</p>
      </div>
    {/if}
  </div>
</div>
