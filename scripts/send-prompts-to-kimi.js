#!/usr/bin/env node
/**
 * Send the NEXO Prompt Pack v3 to Kimi as a final reminder.
 *
 * Usage:
 *   node scripts/send-prompts-to-kimi.js [--chat-url=<url>] [--session-id=<id>] [--user-id=<id>]
 *
 * Environment:
 *   KIMI_BRIDGE_ENABLED=true      required
 *   KIMI_BRIDGE_REUSE_USER_ID=true  optional, keeps the same Kimi tab
 *   KIMI_BRIDGE_FIXED_USER_ID=<id>  optional, fixed userId when reuse is enabled
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');
const {
  intentionPrompt,
  structurePrompt,
  codePrompt,
  reviewPrompt,
  fixPrompt,
  reviewRetryPrompt,
  sanitizePrompt,
  sanitizeRetryPrompt,
  sanitizeReviewPrompt,
  sanitizeRefinePrompt,
} = require('../nexo-lp-server/services/prompts/nexoPromptPack');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.split('=');
    if (key && value !== undefined) {
      const cleanKey = key.replace(/^--/, '');
      args[cleanKey] = value;
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXO Digital - Landing Page Template</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-slate-800">
  <header class="p-6 border-b">
    <div class="container mx-auto flex justify-between">
      <h1 class="text-2xl font-bold text-indigo-600">NEXO Digital</h1>
      <a href="mailto:contato@nexo-digital.app" class="text-sm">contato@nexo-digital.app</a>
    </div>
  </header>
  <main>
    <section class="py-20 text-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div class="container mx-auto">
        <h2 class="text-5xl font-extrabold mb-6">Launch Faster with NEXO</h2>
        <p class="text-xl mb-8 max-w-2xl mx-auto">Trusted by 10,000+ teams. Build high-converting landing pages in minutes.</p>
        <button class="px-8 py-3 bg-indigo-600 text-white rounded-xl">Start Free Trial</button>
      </div>
    </section>
  </main>
  <footer class="p-6 border-t text-center text-sm text-slate-500">
    &copy; 2026 NEXO Digital.
  </footer>
</body>
</html>`;

const SAMPLE_INTENTION = {
  title: 'NEXO Digital SaaS Landing Page',
  description: 'A high-converting single-page landing page for NEXO Digital that drives free-trial signups.',
  niche: 'B2B SaaS',
  audience: 'Startup founders and product teams',
  goal: 'Drive free-trial signups',
  heroAngle: 'Outcome-first: launch faster',
  valueProposition: 'Build conversion-ready landing pages without writing code from scratch',
  objections: ['Is it hard to customize?', 'Will it look generic?'],
  proof: ['customer logos', 'testimonials'],
  ctas: ['Start Free Trial', 'View Templates'],
  sections: ['hero', 'features', 'social-proof', 'pricing', 'faq', 'cta'],
  tone: 'professional',
  colorDirection: { primary: '#6366F1', secondary: '#8B5CF6', accent: '#10B981' },
  constraints: ['single HTML file', 'Tailwind CDN only', 'no external images'],
};

const SAMPLE_STRUCTURE = {
  layout: 'single-page',
  designTokens: {
    colors: { primary: '#6366F1', secondary: '#8B5CF6', accent: '#10B981', dark: '#0F172A', light: '#F8FAFC' },
    typography: 'modern sans-serif stack',
    spacing: 'generous vertical rhythm with clear section breaks',
    motion: 'scroll-driven reveals, subtle hover lifts, one signature micro-interaction',
  },
  sections: [
    {
      id: 'hero',
      type: 'hero-section',
      purpose: 'Grab attention and state the outcome',
      croGoal: 'drive primary CTA click',
      components: ['headline', 'subheadline', 'cta-button', 'social-proof'],
      order: 1,
    },
  ],
  navigation: true,
  responsiveBreakpoints: ['mobile', 'tablet', 'desktop'],
  seoKeywords: ['saas landing page', 'high converting template'],
  imageStrategy: 'Unsplash keyword sets or inline SVG placeholders for every visual',
  croStrategy: 'one goal, repeated CTA, proof near CTA, remove exit links',
};

const SAMPLE_REVIEW = {
  score: 82,
  passed: false,
  issues: [
    { severity: 'warning', message: 'Hero image is missing alt text' },
    { severity: 'suggestion', message: 'Add a testimonials section above the final CTA' },
  ],
  suggestions: ['Add alt text to hero image'],
  metadata: {
    dimensions: {
      a11y: { score: 85, notes: 'missing alt text' },
      codeQuality: { score: 95, notes: 'valid HTML' },
      seo: { score: 80, notes: 'missing meta description' },
      performance: { score: 95, notes: 'lightweight' },
      cro: { score: 88, notes: 'good CTA placement' },
      security: { score: 100, notes: 'clean' },
    },
    rebuildNeeded: false,
    rebuildInstructions: [],
  },
};

function chunkMessage(text, maxLength = 6000) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLength));
    start += maxLength;
  }
  return chunks;
}

async function main() {
  const args = parseArgs(process.argv);

  if (process.env.KIMI_BRIDGE_ENABLED !== 'true') {
    console.error('Set KIMI_BRIDGE_ENABLED=true to send prompts to Kimi.');
    process.exit(1);
  }

  const sessionId = args['session-id'] || `prompt-pack-${Date.now()}`;
  const persisted = {};
  if (args['user-id']) persisted.userId = args['user-id'];
  if (args['chat-url']) persisted.chatUrl = args['chat-url'];

  const context = BridgeAdapter.initializeContext(sessionId, persisted);
  console.log(`Session: ${context.sessionId}`);
  console.log(`UserId:  ${context.userId}`);
  console.log(`ChatUrl: ${context.chatUrl || '(new chat)'}`);
  console.log('');

  const messages = [];

  messages.push(`NEXO Prompt Pack v3 — "Milionário"

This message contains the complete set of prompts NEXO uses to build and sanitize landing pages. Keep them in memory and apply them on every future NEXO generation cycle.

Every site-creation prompt is grounded in multi-million-dollar, high-converting landing-page patterns.`);

  messages.push(intentionPrompt('Create a high-converting SaaS landing page for NEXO Digital.'));
  messages.push(structurePrompt(SAMPLE_INTENTION));
  messages.push(codePrompt(SAMPLE_STRUCTURE, 'static-html-tailwind'));
  messages.push(reviewPrompt(SAMPLE_HTML));
  messages.push(fixPrompt(SAMPLE_HTML, SAMPLE_REVIEW));
  messages.push(reviewRetryPrompt(SAMPLE_HTML, 'The previous response was not valid JSON.', '{"score": 80'));
  messages.push(sanitizePrompt(SAMPLE_HTML));
  messages.push(sanitizeRetryPrompt(SAMPLE_HTML));
  messages.push(sanitizeReviewPrompt(SAMPLE_HTML));
  messages.push(sanitizeRefinePrompt(SAMPLE_HTML, ['Fix broken closing div', 'Replace remaining brand name']));

  let sent = 0;
  const delayMs = BridgeAdapter.cooldownMs || 4000;

  for (const rawMessage of messages) {
    const chunks = chunkMessage(rawMessage);
    for (const chunk of chunks) {
      console.log(`Sending message ${sent + 1}${chunks.length > 1 ? ` (part ${chunks.indexOf(chunk) + 1}/${chunks.length})` : ''}...`);
      try {
        const result = await BridgeAdapter.sendMessage(context, chunk, {
          mode: 'instant',
          phase: 'prompt-reminder',
          newChat: sent === 0 && !context.chatUrl,
        });
        console.log(`  Response length: ${result?.content?.length || 0}`);
        if (result?.chatUrl) context.chatUrl = result.chatUrl;
      } catch (err) {
        console.error(`  Failed to send message: ${err.message}`);
      }
      sent += 1;
      if (sent < messages.length) await sleep(delayMs);
    }
  }

  console.log('');
  console.log(`Sent ${sent} prompt reminder message(s).`);
  console.log(`Chat URL: ${context.chatUrl || 'unknown'}`);

  await BridgeAdapter.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
