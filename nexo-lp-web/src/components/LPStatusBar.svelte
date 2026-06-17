<script>
  import { fade } from 'svelte/transition';
  import { tokens, isGenerating, preview, hasPreview, session, bugReport } from '../stores.js';
  import { estimateLighthouseScores, getScoreColor, getScoreLabel } from '../lib/lighthouseEstimator.js';

  let showLighthouse = false;
  let estimatedScores = null;

  $: {
    if ($hasPreview && $preview.html) {
      estimatedScores = estimateLighthouseScores($preview.html);
    }
  }

  function getScoreBarColor(score) {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function getScoreRingSvg(score) {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);

    return { radius, circumference, offset, color };
  }
</script>

<div class="flex-shrink-0 h-10 bg-white border-t border-luna-border flex items-center px-4 gap-4 text-xs">
  <!-- Connection Status -->
  <div class="flex items-center gap-1.5">
    <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
    <span class="text-luna-text-muted">Connected</span>
  </div>

  <!-- Separator -->
  <div class="w-px h-4 bg-luna-border"></div>

  <!-- Token Usage -->
  <div class="flex items-center gap-2">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-luna-text-muted"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    <span class="text-luna-text-muted">{$tokens.used.toLocaleString()} / {$tokens.total.toLocaleString()}</span>
    <div class="w-16 bg-luna-surface rounded-full h-1.5 overflow-hidden">
      <div
        class="h-full rounded-full bg-gradient-to-r from-luna-primary to-luna-purple transition-all duration-500"
        style="width: {Math.min(100, ($tokens.used / $tokens.total) * 100)}%"
      ></div>
    </div>
  </div>

  <!-- Separator -->
  <div class="w-px h-4 bg-luna-border"></div>

  <!-- Generation Status -->
  {#if $isGenerating}
    <div class="flex items-center gap-1.5 text-luna-primary">
      <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Generating...</span>
    </div>
    <div class="w-px h-4 bg-luna-border"></div>
  {/if}

  <!-- Lighthouse Scores -->
  {#if estimatedScores}
    <div class="flex items-center gap-3 relative">
      <button
        class="flex items-center gap-1.5 text-luna-text-muted hover:text-luna-text transition-colors"
        on:click={() => showLighthouse = !showLighthouse}
      >
        <!-- Overall Score Ring -->
        <svg width="20" height="20" viewBox="0 0 40 40" class="transform -rotate-90">
          <circle cx="20" cy="20" r="16" fill="none" stroke="#E2E8F0" stroke-width="3" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={getScoreColor(estimatedScores.overall)}
            stroke-width="3"
            stroke-dasharray={getScoreRingSvg(estimatedScores.overall).circumference}
            stroke-dashoffset={getScoreRingSvg(estimatedScores.overall).offset}
            stroke-linecap="round"
            class="transition-all duration-500"
          />
        </svg>
        <span class="font-medium" style="color: {getScoreColor(estimatedScores.overall)}">{estimatedScores.overall}</span>
        <span>Lighthouse</span>
      </button>

      <!-- Lighthouse Details Popup -->
      {#if showLighthouse}
        <div
          class="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-lg border border-luna-border p-4 z-50"
          in:fade={{ duration: 150 }}
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-luna-text">Estimated Scores</span>
            <button
              class="text-luna-text-muted hover:text-luna-text"
              on:click={() => showLighthouse = false}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div class="space-y-3">
            {#each [
              { key: 'performance', label: 'Performance' },
              { key: 'accessibility', label: 'Accessibility' },
              { key: 'bestPractices', label: 'Best Practices' },
              { key: 'seo', label: 'SEO' },
            ] as { key, label }}
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-luna-text-muted">{label}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold" style="color: {getScoreColor(estimatedScores[key])}">{estimatedScores[key]}</span>
                    <span class="text-[10px] text-luna-text-muted">{getScoreLabel(estimatedScores[key])}</span>
                  </div>
                </div>
                <div class="w-full bg-luna-surface rounded-full h-1.5 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500 {getScoreBarColor(estimatedScores[key])}"
                    style="width: {estimatedScores[key]}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>

          <p class="text-[10px] text-luna-text-muted mt-3 pt-2 border-t border-luna-border">
            These are estimated scores based on static analysis. Run a real Lighthouse audit for accurate results.
          </p>
        </div>
      {/if}
    </div>

    <div class="w-px h-4 bg-luna-border"></div>
  {/if}

  <!-- Stack Info -->
  <div class="flex items-center gap-1.5 text-luna-text-muted">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
    <span>HTML + CSS + JS</span>
  </div>

  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Right Side Info -->
  {#if $session.id}
    <div class="flex items-center gap-3 text-luna-text-muted">
      <span>Session: {$session.id?.slice(0, 8) || 'new'}...</span>
    </div>
  {/if}
</div>
