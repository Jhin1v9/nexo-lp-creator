><script>
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let title = 'Confirmar';
  export let message = 'Tem certeza?';
  export let confirmLabel = 'Confirmar';
  export let cancelLabel = 'Cancelar';
  export let confirmVariant = 'primary'; // primary | danger
  export let open = false;

  const dispatch = createEventDispatcher();

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) {
      dispatch('cancel');
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      dispatch('cancel');
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4"
    on:click={handleBackdrop}
    on:keydown={handleKeydown}
    role="presentation"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="w-full max-w-md bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      transition:scale={{ duration: 250, easing: quintOut, start: 0.96 }}
    >
      <h3 id="confirm-modal-title" class="text-lg font-semibold text-white mb-2">
        {title}
      </h3>
      <p id="confirm-modal-message" class="text-sm text-slate-300 leading-relaxed mb-6">
        {message}
      </p>
      <div class="flex items-center justify-end gap-3">
        <button
          class="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          on:click={() => dispatch('cancel')}
        >
          {cancelLabel}
        </button>
        <button
          class="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all
            {confirmVariant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-luna-primary hover:bg-luna-primary/90'}"
          on:click={() => dispatch('confirm')}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
