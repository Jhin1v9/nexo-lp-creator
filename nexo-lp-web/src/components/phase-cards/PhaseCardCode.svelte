<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: stack = data.stack || '';
  $: files = Array.isArray(data.files) ? data.files : [];
  $: dependencies = Array.isArray(data.dependencies) ? data.dependencies : [];
  $: buildCommand = data.build_command || '';

  function fileIcon(path) {
    if (!path) return '📄';
    const ext = path.split('.').pop()?.toLowerCase();
    if (ext === 'html') return '🌐';
    if (ext === 'css') return '🎨';
    if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') return '⚡';
    if (ext === 'json') return '📋';
    if (ext === 'svelte') return '🔥';
    if (ext === 'vue') return '💚';
    return '📄';
  }

  function fileName(file) {
    if (typeof file === 'string') return file;
    return file?.path || file?.name || JSON.stringify(file);
  }
</script>

<PhaseCardBase
  title="Gerando código"
  message={event?.message || 'Escrevendo HTML/CSS/JS...'}
  status={event?.status}
  icon="💻"
  {isGenerating}
  defaultExpanded={event?.status === 'loading' || event?.status === 'error'}
>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2 text-[11px]">
      {#if stack}
        <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-700'}">
          Stack: {stack}
        </span>
      {/if}
      {#if files.length > 0}
        <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-700'}">
          {files.length} arquivo{files.length > 1 ? 's' : ''}
        </span>
      {/if}
    </div>

    {#if files.length > 0}
      <div>
        <div class="text-[10px] uppercase tracking-wide mb-1.5 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Arquivos gerados</div>
        <div class="space-y-1">
          {#each files as file}
            <div class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
              <span class="text-sm">{fileIcon(fileName(file))}</span>
              <span class="font-mono truncate">{fileName(file)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if dependencies.length > 0}
      <div>
        <div class="text-[10px] uppercase tracking-wide mb-1.5 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Dependências</div>
        <div class="flex flex-wrap gap-1">
          {#each dependencies as dep}
            <span class="text-[10px] px-1.5 py-0.5 rounded border {isGenerating ? 'border-white/10 bg-white/5 text-white/80' : 'border-luna-border bg-white text-luna-text-secondary'}">
              {dep}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if buildCommand}
      <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
        <div class="text-[10px] uppercase tracking-wide mb-1 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Build</div>
        <code class="text-[10px] font-mono block truncate">{buildCommand}</code>
      </div>
    {/if}
  </div>
</PhaseCardBase>
