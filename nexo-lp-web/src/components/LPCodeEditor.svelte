<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { preview } from '../stores.js';
  import { formatHtml } from '../lib/previewBuilder.js';
  import { lpClient } from '../lib/lpClient.js';

  let formattedCode = '';
  let copied = false;
  let activeTab = 'html';
  let lineCount = 0;
  let charCount = 0;

  const tabs = [
    { id: 'html', label: 'HTML', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
    { id: 'css', label: 'CSS', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/></svg>' },
    { id: 'preview', label: 'Minified', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>' },
  ];

  async function refreshCode(previewHtml) {
    let htmlContent = previewHtml;
    if (!htmlContent) {
      try {
        htmlContent = await lpClient.fetchHtml();
      } catch (error) {
        console.error('Failed to fetch HTML:', error);
      }
    }
    if (htmlContent) {
      if (activeTab === 'html') {
        formattedCode = formatHtml(htmlContent);
      } else if (activeTab === 'css') {
        formattedCode = extractCSS(htmlContent);
      } else {
        formattedCode = htmlContent;
      }
      const lines = formattedCode.split('\n');
      lineCount = lines.length;
      charCount = formattedCode.length;
    } else {
      formattedCode = '<!-- No code generated yet. Chat with Luna to create your landing page. -->';
      lineCount = 1;
      charCount = formattedCode.length;
    }
  }

  $: refreshCode($preview.html);

  function extractCSS(html) {
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const cssMatches = html.match(/style="([^"]*)"/gi) || [];

    let css = '/* Extracted CSS */\n\n';

    styleMatches.forEach((match, i) => {
      const content = match.replace(/<style[^>]*>|<\/style>/gi, '');
      css += `/* Style block ${i + 1} */\n${content}\n\n`;
    });

    if (cssMatches.length > 0) {
      css += '/* Inline styles */\n';
      cssMatches.forEach(match => {
        css += `${match}\n`;
      });
    }

    return css || '/* No CSS found in the generated HTML */';
  }

  function getLineNumbers() {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }

  function handleCopy() {
    navigator.clipboard.writeText(formattedCode).then(() => {
      copied = true;
      setTimeout(() => copied = false, 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([formattedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'landing-page.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeForDisplay(code) {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function syntaxHighlight(code) {
    let escaped = escapeForDisplay(code);

    // Highlight HTML tags
    escaped = escaped.replace(/(&lt;\/?)([\w-]+)/g, '<span class="token-tag">$1$2</span>');

    // Highlight attributes
    escaped = escaped.replace(/([\w-]+)(=)/g, '<span class="token-attr">$1</span>$2');

    // Highlight strings
    escaped = escaped.replace(/&quot;([^&]*)&quot;/g, '<span class="token-string">&quot;$1&quot;</span>');

    // Highlight comments
    escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="token-comment">$1</span>');

    // Highlight CSS properties (in style tags)
    escaped = escaped.replace(/([\w-]+)(\s*:)/g, (match, prop, colon) => {
      if (['color', 'background', 'margin', 'padding', 'width', 'height', 'display', 'font', 'border', 'position', 'top', 'left', 'right', 'bottom', 'text', 'flex', 'grid', 'transform', 'transition', 'animation'].some(p => prop.includes(p))) {
        return `<span class="token-keyword">${prop}</span>${colon}`;
      }
      return match;
    });

    return escaped;
  }
</script>

<div class="flex flex-col h-full bg-white">
  <!-- Header -->
  <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-luna-border">
    <div class="flex items-center gap-4">
      <!-- Tabs -->
      <div class="flex items-center gap-1">
        {#each tabs as tab}
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            class:bg-luna-surface={activeTab !== tab.id}
            class:text-luna-text={activeTab !== tab.id}
            class:bg-luna-primary={activeTab === tab.id}
            class:text-white={activeTab === tab.id}
            on:click={() => activeTab = tab.id}
          >
            <span class="flex items-center justify-center w-3.5 h-3.5">
              {@html tab.icon}
            </span>
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Stats -->
      <div class="hidden sm:flex items-center gap-3 text-[10px] text-luna-text-muted border-l border-luna-border pl-4">
        <span>{lineCount} lines</span>
        <span>{charCount.toLocaleString()} chars</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-luna-border text-luna-text-secondary hover:bg-luna-surface transition-all"
        on:click={handleCopy}
      >
        {#if copied}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-emerald-500">Copied!</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy
        {/if}
      </button>
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-luna-border text-luna-text-secondary hover:bg-luna-surface transition-all"
        on:click={handleDownload}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        Download
      </button>
    </div>
  </div>

  <!-- Code Area -->
  <div class="flex-1 overflow-auto code-dark">
    <div class="flex min-h-full">
      <!-- Line Numbers -->
      <div class="flex-shrink-0 w-12 bg-[#0a0f1d] border-r border-slate-800 text-right py-4 select-none">
        {#each getLineNumbers() as num}
          <div class="px-2 text-[11px] text-slate-600 leading-6 font-mono">{num}</div>
        {/each}
      </div>

      <!-- Code Content -->
      <div class="flex-1 py-4 overflow-auto">
        <pre class="text-[13px] leading-6 font-mono px-4"><code>{@html syntaxHighlight(formattedCode)}</code></pre>
      </div>
    </div>
  </div>
</div>
