<script>
  import { onMount, tick, afterUpdate } from 'svelte';
  import { fade, fly, slide, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { messages, isGenerating, currentTool, preview, tokens, currencies, generationMode, generationPageMode, session, editorTab, showNotification, kimiChatUrl, contextWarning, contextInfo, contextUsagePercent, generationEvents, generationOverlayMinimized } from '../stores.js';
  import { lpClient } from '../lib/lpClient.js';
  import { projectNameFromPrompt } from '../lib/projectName.js';
  import GenerationModeSwitch from './GenerationModeSwitch.svelte';
  import { getCurrencyBalance } from '../api.js';
  import LPWelcomeScreen from './LPWelcomeScreen.svelte';
  import ToolCard from './ToolCard.svelte';
  import ModeSelector from './ModeSelector.svelte';
  import GenerationPhaseCards from './GenerationPhaseCards.svelte';
  import LPPhaseInfoCard from './LPPhaseInfoCard.svelte';
  import LPConfirmationModal from './LPConfirmationModal.svelte';

  let inputValue = '';
  let chatContainer;
  let inputRef;
  let isStreaming = false;
  let streamingContent = '';
  let isTyping = false;
  let scrollToBottomTimeout;
  let responseBuffer = '';
  let activeEventSource = null;
  let showCancelModal = false;

  function syncContextStores() {
    kimiChatUrl.set(lpClient.getKimiChatUrl());
    contextWarning.set(lpClient.getContextWarning());
    contextInfo.set(lpClient.getContextInfo());
  }

  async function loadCurrencyBalance() {
    if (!lpClient.userId) return;
    try {
      const balance = await getCurrencyBalance(lpClient.userId);
      currencies.set(balance);
    } catch (error) {
      console.error('Failed to load currency balance:', error);
    }
  }

  $: if ($session.id && lpClient.userId) {
    loadCurrencyBalance();
  }

  $: {
    lpClient.setMode($generationMode);
  }

  $: {
    lpClient.setGenerationMode($generationPageMode);
  }

  const suggestedPrompts = [
    { icon: '🚀', text: 'Create a SaaS landing page with pricing and features', category: 'SaaS' },
    { icon: '🏥', text: 'Build a modern dental clinic website', category: 'Clinic' },
    { icon: '📚', text: 'Design an online course landing page', category: 'Education' },
    { icon: '📱', text: 'Create a mobile app showcase page', category: 'App' },
    { icon: '🍔', text: 'Build a restaurant landing page with menu', category: 'Food' },
    { icon: '💼', text: 'Design a portfolio website for a designer', category: 'Portfolio' },
  ];

  let userScrolledUp = false;

  function scrollToBottom(force = false, smooth = true) {
    clearTimeout(scrollToBottomTimeout);
    scrollToBottomTimeout = setTimeout(async () => {
      await tick();
      if (chatContainer && (force || !userScrolledUp)) {
        if (smooth) {
          chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        } else {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
    }, 50);
  }

  function handleScroll() {
    if (!chatContainer) return;
    const nearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 80;
    userScrolledUp = !nearBottom;
  }

  let lastGenerationEventCount = 0;
  afterUpdate(() => {
    scrollToBottom();
    // Force scroll when new generation events/tool cards are rendered
    if ($generationEvents.length !== lastGenerationEventCount) {
      lastGenerationEventCount = $generationEvents.length;
      scrollToBottom(true, false);
    }
  });



  async function handleSend() {
    const message = inputValue.trim();
    if (!message || $isGenerating) return;

    // Add user message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
      type: 'text',
    };
    messages.update(m => [...m, userMsg]);
    inputValue = '';
    isGenerating.set(true);
    isStreaming = true;
    streamingContent = '';
    isTyping = true;
    responseBuffer = '';

    // Initialize session if needed. Use the first user message as the
    // project/chat title instead of a generic default.
    if (!lpClient.isReady) {
      try {
        const projectName = projectNameFromPrompt(message, $session.projectName || 'Untitled Project');
        await lpClient.init(projectName);
        session.update(s => ({ ...s, id: lpClient.sessionId, projectName }));
        syncContextStores();
      } catch (error) {
        console.error('Failed to initialize session:', error);
        // Fallback: add error message
        messages.update(m => [...m, {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: "I'm having trouble connecting right now. Let me try a different approach! Could you repeat your request?",
          timestamp: Date.now(),
          type: 'text',
        }]);
        isGenerating.set(false);
        isStreaming = false;
        isTyping = false;
        return;
      }
    }

    // Add placeholder for assistant response
    const assistantMsgId = `msg_${Date.now() + 1}`;
    messages.update(m => [...m, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      type: 'streaming',
    }]);

    try {
      let finalHtml = null;
      let toolCalls = [];

      await lpClient.sendMessage(message, (update) => {
        if (update.type === 'chunk') {
          streamingContent = update.content;
          messages.update(m => m.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: update.content, type: 'streaming' }
              : msg
          ));
        } else if (update.type === 'response') {
          responseBuffer = update.content || '';
          messages.update(m => m.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: responseBuffer, type: 'streaming' }
              : msg
          ));
        } else if (update.type === 'tool') {
          toolCalls = [...toolCalls, update.tool];
          currentTool.set(update.tool);
        } else if (update.type === 'complete') {
          finalHtml = update.html;
        }
      });

      // Finalize assistant message
      const finalContent = streamingContent || "I've worked on your request! Check the Preview tab to see the result.";
      messages.update(m => m.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: finalContent, type: 'text', html: finalHtml }
          : msg
      ));

      // Update preview if HTML was generated
      if (finalHtml) {
        preview.set({
          html: finalHtml,
          lastUpdated: Date.now(),
          device: $preview.device,
        });
      }

      // Update tokens
      tokens.update(t => ({ ...t, used: t.used + Math.floor(message.length / 10) + 50 }));

      // Sync Kimi context state after generation
      syncContextStores();

      // Auto-switch to preview if we have HTML
      if (finalHtml) {
        setTimeout(() => {
          editorTab.set('preview');
          showNotification('Preview updated!', 'success');
        }, 1000);
      }

    } catch (error) {
      console.error('Chat error:', error);
      messages.update(m => m.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: "Oops! Something went wrong on my end. Could you try again? I'll do better this time!", type: 'text' }
          : msg
      ));
    } finally {
      isGenerating.set(false);
      isStreaming = false;
      isTyping = false;
      currentTool.set(null);
      setTimeout(() => inputRef?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(prompt) {
    inputValue = prompt.text;
    tick().then(() => inputRef?.focus());
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function useSuggestion(suggestion) {
    inputValue = suggestion;
    tick().then(() => handleSend());
  }
</script>

<div
  class="flex flex-col h-full transition-colors duration-700 ease-in-out"
  class:bg-white={!$isGenerating}
  class:bg-transparent={$isGenerating}
>
  <!-- Messages Area -->
  <div
    bind:this={chatContainer}
    on:scroll={handleScroll}
    class="flex-1 overflow-y-auto px-4 py-6 space-y-5 scroll-smooth transition-all duration-700 ease-in-out"
    class:max-w-3xl={$isGenerating}
    class:mx-auto={$isGenerating}
    class:w-full={$isGenerating}
  >
    {#if $messages.length <= 1}
      <!-- Welcome Screen -->
      <LPWelcomeScreen on:select={(e) => useSuggestion(e.detail)} />
    {:else}
      <!-- Chat Messages -->
      {#each $messages as message, i (message.id)}
        <div
          class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
          in:fly={{ y: 10, duration: 250, easing: quintOut }}
        >
          <div class="flex gap-3 max-w-[85%] {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
            <!-- Avatar -->
            <div
              class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-700 {message.role === 'user' ? 'bg-gradient-to-br from-luna-primary to-luna-purple text-white' : ($isGenerating ? 'bg-white bg-opacity-15 text-white' : 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600')}"
            >
              {#if message.role === 'user'}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              {/if}
            </div>

            <!-- Message Bubble -->
            <div class="flex flex-col gap-1 {message.role === 'user' ? 'items-end' : 'items-start'}">
              <div
                class="px-4 py-3 rounded-2xl text-sm leading-relaxed transition-colors duration-700 {message.role === 'user' ? 'bg-gradient-to-br from-luna-primary to-luna-purple text-white rounded-br-md' : ($isGenerating ? 'bg-white bg-opacity-10 text-white border border-white border-opacity-20 rounded-bl-md' : 'bg-luna-surface text-luna-text border border-luna-border rounded-bl-md')}"
              >
                {#if message.role === 'assistant' && message.type !== 'streaming'}
                  <LPPhaseInfoCard content={message.content} />
                {:else}
                  <div class="whitespace-pre-wrap">{message.content}</div>
                {/if}
              </div>

              <!-- Timestamp -->
              <span
                class="text-[10px] px-1 transition-colors duration-700 {message.role === 'user' ? 'text-white/60' : ($isGenerating ? 'text-white text-opacity-50' : 'text-luna-text-muted')}"
              >{formatTime(message.timestamp)}</span>

              <!-- Tool cards shown during generation -->
              {#if message.role === 'assistant' && message.type === 'streaming' && $currentTool}
                <div in:slide={{ duration: 200 }}>
                  <ToolCard tool={$currentTool} />
                </div>
              {/if}

              <!-- HTML generated indicator -->
              {#if message.html}
                <button
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors mt-1"
                  on:click={() => editorTab.set('preview')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  View generated page
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}

    <!-- Real-time generation phase cards (shown only when not in fullscreen overlay) -->
    {#if !$isGenerating && $generationEvents.length > 0}
      <div class="flex justify-start" in:slide={{ duration: 200 }}>
        <div class="flex gap-3 w-full max-w-[85%]">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 flex items-center justify-center text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <GenerationPhaseCards events={$generationEvents} />
          </div>
        </div>
      </div>
    {/if}

  </div>

  <!-- Quick Suggestions (when not generating) -->
  {#if !$isGenerating && $messages.length > 1 && $messages.length < 4}
    <div class="flex-shrink-0 px-4 pb-3" in:slide={{ duration: 200 }}>
      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each ['Make it more modern', 'Add a contact form', 'Change the colors', 'Add animations'] as suggestion}
          <button
            class="flex-shrink-0 px-3 py-1.5 rounded-full bg-luna-surface border border-luna-border text-xs text-luna-text-secondary hover:bg-luna-primary/10 hover:border-luna-primary/30 hover:text-luna-primary transition-all"
            on:click={() => useSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Context / Open in Kimi -->
  {#if $session.id && ($kimiChatUrl || $contextWarning !== 'none')}
    <div
      class="flex-shrink-0 px-4 py-2 transition-colors duration-700 {$isGenerating ? 'bg-black bg-opacity-40 backdrop-blur-md border-t border-white border-opacity-10' : 'bg-white border-t border-luna-border'}"
    >
      <div class="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
        {#if $kimiChatUrl}
          {#if $isGenerating}
            <button
              type="button"
              on:click={() => generationOverlayMinimized.set(false)}
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors bg-white bg-opacity-10 text-white border-white border-opacity-20 hover:bg-white hover:bg-opacity-20"
              title="Voltar ao overlay de geração"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
              Voltar ao universo LP
            </button>
          {:else}
            <a
              href={$kimiChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
              title="Open this session in Kimi"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
              Open in Kimi
            </a>
          {/if}
        {/if}
        {#if $contextWarning !== 'none'}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border {$contextWarning === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}"
            title={$contextWarning === 'critical' ? 'Critical: near Kimi context limit' : 'Approaching Kimi context limit'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            Context: {$contextUsagePercent}%
          </span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Mode selector + Input Area -->
  <div
    class="flex-shrink-0 px-4 py-3 transition-colors duration-700 ease-in-out {$isGenerating ? 'bg-black bg-opacity-40 backdrop-blur-md' : 'bg-white border-t border-luna-border'}"
  >
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <ModeSelector bind:mode={$generationMode} balance={$currencies} disabled={$isGenerating} />
      <GenerationModeSwitch />
    </div>
    <div class="flex items-end gap-3 max-w-4xl mx-auto mt-2">
      <div class="flex-1 relative">
        <textarea
          bind:this={inputRef}
          bind:value={inputValue}
          on:keydown={handleKeyDown}
          placeholder="Describe the landing page you want to create..."
          class="w-full px-4 py-3 pr-12 rounded-xl border resize-none input-focus transition-all {$isGenerating ? 'border-white border-opacity-20 bg-white bg-opacity-10 text-white placeholder-white placeholder-opacity-50' : 'border-luna-border bg-luna-surface text-luna-text placeholder-luna-text-muted'}"
          rows="1"
          style="min-height: 44px; max-height: 120px;"
          disabled={$isGenerating}
        ></textarea>
        {#if inputValue.length > 0 && !$isGenerating}
          <button
            class="absolute right-3 top-1/2 -translate-y-1/2 text-luna-text-muted hover:text-luna-primary transition-colors"
            on:click={() => inputValue = ''}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        {/if}
      </div>
      <button
        class="flex-shrink-0 w-10 h-10 rounded-xl text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none transition-all {$isGenerating ? 'bg-white bg-opacity-20 backdrop-blur-md' : 'btn-primary'}"
        disabled={!inputValue.trim() || $isGenerating}
        on:click={handleSend}
      >
        {#if $isGenerating}
          <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        {/if}
      </button>
    </div>
    <div class="text-center mt-2">
      <span
        class="text-[10px] transition-colors duration-700 {$isGenerating ? 'text-white text-opacity-50' : 'text-luna-text-muted'}"
      >Press Enter to send, Shift+Enter for new line</span>
    </div>
  </div>
</div>
