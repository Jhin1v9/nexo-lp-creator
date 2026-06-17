<script>
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let tool = null;

  $: toolType = tool?.type || tool?.name || 'unknown';
  $: toolStatus = tool?.status || 'loading';
  $: toolTitle = getToolTitle(toolType);
  $: toolDescription = tool?.description || getToolDescription(toolType);
  $: toolIcon = getToolIcon(toolType);

  function getToolTitle(type) {
    const titles = {
      // NEXO generation phases
      intention: 'Understanding Requirements',
      structure: 'Designing Structure',
      code: 'Writing Code',
      review: 'Reviewing Code',
      preview: 'Building Preview',
      deploy: 'Preparing Deployment',
      generation: 'Generating Landing Page',
      // Generic tool types
      writeFile: 'Writing File',
      executeShell: 'Executing Command',
      applyDiff: 'Applying Changes',
      readFile: 'Reading File',
      generateImage: 'Generating Image',
      searchWeb: 'Searching Web',
      build: 'Building Project',
      install: 'Installing Dependencies',
      default: 'Working...',
    };
    return titles[type] || titles.default;
  }

  function getToolDescription(type) {
    const descriptions = {
      // NEXO generation phases
      intention: 'Analyzing your request and extracting requirements',
      structure: 'Planning the page layout and component hierarchy',
      code: 'Generating HTML, CSS and JavaScript for your landing page',
      review: 'Checking the generated code for issues and improvements',
      preview: 'Preparing a live preview of your landing page',
      deploy: 'Getting deployment options ready',
      generation: 'Orchestrating the full generation pipeline',
      // Generic tool types
      writeFile: 'Creating and writing HTML/CSS/JS files for your landing page',
      executeShell: 'Running build commands and processing files',
      applyDiff: 'Applying precise code modifications',
      readFile: 'Reading project files for context',
      generateImage: 'Creating custom images for your design',
      searchWeb: 'Looking up references and best practices',
      build: 'Compiling and optimizing the project',
      install: 'Setting up project dependencies',
      default: 'Processing your request...',
    };
    return descriptions[type] || descriptions.default;
  }

  function getToolIcon(type) {
    const icons = {
      // NEXO generation phases
      intention: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/></svg>`,
      structure: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
      code: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
      review: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      preview: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      deploy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>`,
      generation: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`,
      // Generic tool types
      writeFile: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
      executeShell: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>`,
      applyDiff: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      readFile: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      generateImage: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
      searchWeb: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
      build: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2.41 2.41 0 0 0 2.4 2.4 2.41 2.41 0 0 0 2.4-2.4 2.41 2.41 0 0 0-2.4-2.4A2.41 2.41 0 0 0 2 20z"/><path d="M2 4a2.41 2.41 0 0 0 2.4 2.4A2.41 2.41 0 0 0 6.8 4 2.41 2.41 0 0 0 4.4 1.6 2.41 2.41 0 0 0 2 4z"/><path d="M2 12a2.41 2.41 0 0 0 2.4 2.4 2.41 2.41 0 0 0 2.4-2.4 2.41 2.41 0 0 0-2.4-2.4A2.41 2.41 0 0 0 2 12z"/><path d="m18.01 12.01.01-.01"/><path d="M22 8c0-2.21-1.79-4-4-4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2c2.21 0 4-1.79 4-4"/><path d="m6.81 12 8.58-5.09a1 1 0 0 0 .47-.86V3.5"/><path d="M16.5 3.5V7a1 1 0 0 0 .47.86l2.53 1.5"/></svg>`,
      install: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
      default: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`,
    };
    return icons[type] || icons.default;
  }

  function getStatusIcon() {
    if (toolStatus === 'success') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    }
    if (toolStatus === 'error') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>`;
    }
    return null; // Loading spinner handled in template
  }
</script>

{#if tool}
  <div
    class="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-luna-border shadow-sm max-w-md mt-2"
    in:slide={{ duration: 200, easing: quintOut }}
  >
    <!-- Icon -->
    <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-luna-primary/10 text-luna-primary flex items-center justify-center">
      {@html toolIcon}
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-luna-text">{toolTitle}</span>
        {#if toolStatus === 'loading'}
          <svg class="animate-spin w-3.5 h-3.5 text-luna-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else if toolStatus === 'success'}
          <span in:fade>{@html getStatusIcon()}</span>
        {:else if toolStatus === 'error'}
          <span in:fade>{@html getStatusIcon()}</span>
        {/if}
      </div>
      <p class="text-xs text-luna-text-muted mt-0.5">{toolDescription}</p>
      {#if tool.file}
        <div class="flex items-center gap-1.5 mt-2 px-2 py-1 rounded bg-luna-surface text-xs text-luna-text-secondary font-mono">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          {tool.file}
        </div>
      {/if}
    </div>
  </div>
{/if}
