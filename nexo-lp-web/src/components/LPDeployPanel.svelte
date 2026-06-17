<script>
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { preview, deployState, session, showNotification } from '../stores.js';
  import { githubAuth } from '../lib/githubAuth.js';
  import { lpClient } from '../lib/lpClient.js';
  import { API_BASE } from '../api.js';

  let activeDeploy = null;
  let deployProgress = 0;
  let deployLog = [];

  const deployOptions = [
    {
      id: 'github',
      title: 'GitHub Pages',
      description: 'Deploy directly to GitHub Pages for free hosting with custom domain support.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
      color: 'from-slate-700 to-slate-900',
      bgLight: 'bg-slate-50',
      borderHover: 'hover:border-slate-400',
      requiresAuth: true,
    },
    {
      id: 'html',
      title: 'Download HTML',
      description: 'Download the generated landing page as a single HTML file.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
      color: 'from-indigo-500 to-indigo-700',
      bgLight: 'bg-indigo-50',
      borderHover: 'hover:border-indigo-300',
      requiresAuth: false,
    },
    {
      id: 'zip',
      title: 'ZIP Download',
      description: 'Download your landing page as a ZIP file with all assets included.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h4l4 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M10 2v4"/><path d="M6 12h12"/><path d="M6 16h12"/></svg>`,
      color: 'from-blue-500 to-blue-700',
      bgLight: 'bg-blue-50',
      borderHover: 'hover:border-blue-300',
      requiresAuth: false,
    },
    {
      id: 'copy',
      title: 'Copy Code',
      description: 'Copy the HTML code to your clipboard for manual deployment anywhere.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
      color: 'from-emerald-500 to-emerald-700',
      bgLight: 'bg-emerald-50',
      borderHover: 'hover:border-emerald-300',
      requiresAuth: false,
    },
  ];

  async function handleDeploy(option) {
    if (activeDeploy) return;

    activeDeploy = option.id;
    deployProgress = 0;
    deployLog = [];

    addLog(`Starting ${option.title} deployment...`);

    try {
      if (option.id === 'github') {
        await deployToGitHub();
      } else if (option.id === 'html') {
        await downloadHtml();
      } else if (option.id === 'zip') {
        await downloadZip();
      } else if (option.id === 'copy') {
        await copyCode();
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      deployState.set({ status: 'error', url: null, platform: option.id });
      showNotification('Deployment failed', 'error');
    } finally {
      setTimeout(() => {
        activeDeploy = null;
      }, 2000);
    }
  }

  async function deployToGitHub() {
    if (!githubAuth.isAuthenticated) {
      addLog('Starting GitHub authentication...');
      deployProgress = 10;

      const authData = await githubAuth.startAuth();
      addLog(`Please visit ${authData.verificationUri} and enter code: ${authData.userCode}`);

      deployProgress = 30;
      const result = await githubAuth.pollForToken(authData.deviceCode, authData.interval);
      addLog(`Authenticated as ${result.user.login}`, 'success');
    }

    deployProgress = 50;
    addLog('Uploading to GitHub Pages...');

    // Simulate deployment steps
    await simulateProgress(50, 90, 2000);

    deployProgress = 100;
    const url = `https://${githubAuth.getUser()?.login || 'user'}.github.io/landing-page`;
    deployState.set({ status: 'success', url, platform: 'github' });
    addLog(`Deployed! URL: ${url}`, 'success');
    showNotification('Deployed to GitHub Pages!', 'success');
  }

  async function downloadHtml() {
    deployProgress = 20;
    addLog('Preparing HTML file...');

    const html = $preview.html || lpClient.getHtml();
    if (!html) {
      throw new Error('No HTML content to download');
    }

    await simulateProgress(20, 90, 800);

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'landing-page.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    deployProgress = 100;
    deployState.set({ status: 'success', url: null, platform: 'html' });
    addLog('HTML download complete!', 'success');
    showNotification('HTML downloaded!', 'success');
  }

  async function downloadZip() {
    deployProgress = 20;
    addLog('Requesting ZIP from server...');

    const result = await lpClient.deploy('zip');
    if (!result?.downloadUrl) {
      throw new Error(result?.error || 'ZIP generation failed');
    }

    deployProgress = 80;
    addLog('ZIP ready, starting download...');

    const baseUrl = API_BASE.replace('/api/nexo-lp', '');
    window.location.href = `${baseUrl}${result.downloadUrl}`;

    deployProgress = 100;
    deployState.set({ status: 'success', url: null, platform: 'zip' });
    addLog('ZIP download complete!', 'success');
    showNotification('ZIP downloaded!', 'success');
  }

  async function copyCode() {
    deployProgress = 30;
    addLog('Copying code to clipboard...');

    const html = $preview.html;
    if (!html) {
      throw new Error('No HTML content to copy');
    }

    await navigator.clipboard.writeText(html);

    deployProgress = 100;
    deployState.set({ status: 'success', url: null, platform: 'copy' });
    addLog('Code copied to clipboard!', 'success');
    showNotification('Code copied to clipboard!', 'success');
  }

  async function simulateProgress(from, to, duration) {
    const steps = 20;
    const increment = (to - from) / steps;
    const delay = duration / steps;

    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, delay));
      deployProgress = Math.round(from + increment * (i + 1));
    }
  }

  function addLog(message, type = 'info') {
    deployLog = [...deployLog, { message, type, timestamp: Date.now() }];
  }

  function getStatusIcon(status) {
    if (status === 'success') return 'text-emerald-500';
    if (status === 'error') return 'text-red-500';
    return 'text-blue-500';
  }
</script>

<div class="flex flex-col h-full bg-white overflow-y-auto">
  <div class="p-6 max-w-3xl mx-auto w-full space-y-6">
    <!-- Header -->
    <div class="text-center" in:fade={{ duration: 300 }}>
      <h2 class="text-xl font-semibold text-luna-text mb-2">Deploy Your Landing Page</h2>
      <p class="text-sm text-luna-text-muted">Choose how you want to publish your landing page.</p>
    </div>

    <!-- Deploy Options -->
    <div class="grid grid-cols-1 gap-4" in:fly={{ y: 15, duration: 300 }}>
      {#each deployOptions as option}
        <button
          class="flex items-start gap-4 p-5 rounded-xl border-2 border-luna-border bg-white text-left transition-all duration-200 {option.borderHover}"
          class:border-luna-primary={activeDeploy === option.id}
          class:shadow-md={activeDeploy === option.id}
          class:opacity-60={activeDeploy && activeDeploy !== option.id}
          class:cursor-not-allowed={!!activeDeploy}
          on:click={() => handleDeploy(option)}
          disabled={!!activeDeploy}
        >
          <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br {option.color} flex items-center justify-center text-white shadow-sm">
            {@html option.icon}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-luna-text mb-1">{option.title}</h3>
            <p class="text-sm text-luna-text-muted">{option.description}</p>

            {#if activeDeploy === option.id}
              <div class="mt-3 space-y-2" in:slide={{ duration: 200 }}>
                <!-- Progress Bar -->
                <div class="w-full bg-luna-surface rounded-full h-2 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-luna-primary to-luna-purple transition-all duration-500"
                    style="width: {deployProgress}%"
                  ></div>
                </div>
                <span class="text-xs text-luna-text-muted">{deployProgress}%</span>

                <!-- Deploy Logs -->
                <div class="bg-luna-surface rounded-lg p-2 max-h-24 overflow-y-auto">
                  {#each deployLog as log}
                    <div class="text-[11px] font-mono py-0.5 {getStatusIcon(log.type)}">
                      <span class="text-luna-text-muted">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      {' '}{log.message}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Deploy Result -->
            {#if $deployState.platform === option.id && $deployState.status === 'success' && $deployState.url}
              <div class="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200" in:scale={{ duration: 200 }}>
                <div class="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  <a
                    href={$deployState.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-emerald-700 font-medium hover:underline truncate"
                  >
                    {$deployState.url}
                  </a>
                </div>
              </div>
            {/if}
          </div>

          <div class="flex-shrink-0 self-center">
            {#if activeDeploy === option.id}
              <svg class="animate-spin w-5 h-5 text-luna-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-luna-text-muted"><path d="m9 18 6-6-6-6"/></svg>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    <!-- Info Card -->
    <div class="p-4 rounded-xl bg-amber-50 border border-amber-200" in:fade={{ duration: 300, delay: 200 }}>
      <div class="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600 flex-shrink-0 mt-0.5"><path d="M12 2a8 8 0 0 0-8 8c0 3.866 2.582 6.642 4.96 8.12A3 3 0 0 1 12 22a3 3 0 0 1 3.04-3.88C17.418 16.642 20 13.866 20 10a8 8 0 0 0-8-8Z"/><path d="M12 14v4"/><path d="M12 6v4"/></svg>
        <div>
          <p class="text-sm font-medium text-amber-800">Pro Tip</p>
          <p class="text-xs text-amber-700 mt-1">
            For the best results, make sure your landing page looks good in the Preview tab before deploying.
            You can always go back and make changes!
          </p>
        </div>
      </div>
    </div>
  </div>
</div>
