#!/usr/bin/env node
/**
 * Isolated test for the sanitization pipeline.
 * Creates a test session + template and runs SanitizationOrchestrator.startSanitization.
 * The Chrome window should be visible so you can watch Kimi work.
 */

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.NEXO_LP_DB_PATH = path.join(__dirname, '..', 'data', 'nexo-lp-test-sanitization.db');
process.env.KIMI_BRIDGE_ENABLED = 'true';

const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');
const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');
const PreviewService = require('../nexo-lp-server/services/lpPreviewService');
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acme Corp - Best SaaS Ever</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-slate-800">
  <header class="p-6 border-b">
    <div class="container mx-auto flex justify-between">
      <h1 class="text-2xl font-bold text-indigo-600">Acme Corp</h1>
      <a href="mailto:ceo@acme.example" class="text-sm">ceo@acme.example</a>
    </div>
  </header>
  <main>
    <section class="py-20 text-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div class="container mx-auto">
        <h2 class="text-5xl font-extrabold mb-6">Launch Faster with Acme</h2>
        <p class="text-xl mb-8 max-w-2xl mx-auto">Trusted by 10,000+ teams at Acme Industries. Call us at +1-555-0199.</p>
        <button class="px-8 py-3 bg-indigo-600 text-white rounded-xl">Start Free Trial</button>
      </div>
    </section>
    <section class="py-16 container mx-auto">
      <h3 class="text-3xl font-bold mb-8 text-center">Features</h3>
      <div class="grid grid-cols-3 gap-8">
        <div class="p-6 rounded-2xl border"><h4 class="font-bold mb-2">Fast</h4><p>Blazing fast performance.</p></div>
        <div class="p-6 rounded-2xl border"><h4 class="font-bold mb-2">Secure</h4><p>Enterprise grade security.</p></div>
        <div class="p-6 rounded-2xl border"><h4 class="font-bold mb-2">Scalable</h4><p>Grow without limits.</p></div>
      </div>
    </section>
  </main>
  <footer class="p-6 border-t text-center text-sm text-slate-500">
    &copy; 2026 Acme Corp. 123 Market St, San Francisco, CA.
  </footer>
</body>
</html>`;

async function main() {
  const dbPath = process.env.NEXO_LP_DB_PATH;
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  await initializeDatabase();

  try {
    const userId = `test-sanitization-${Date.now()}`;
    const session = await SessionRepository.create({
      user_id: userId,
      initial_prompt: 'Create a SaaS landing page for Acme Corp',
      stack: 'static-html-tailwind',
      status: 'preview',
      current_html: SAMPLE_HTML,
    });

    console.log(`Created session: ${session.id}`);

    const token = PreviewService.generatePublicToken();
    await PreviewService.publishPublicPreview(session.id, SAMPLE_HTML, token);

    const template = await TemplateRepository.create({
      name: 'Acme Test Template',
      description: 'Test template for sanitization pipeline',
      category: 'landing',
      stack: 'static-html-tailwind',
      html: SAMPLE_HTML,
      original_html: SAMPLE_HTML,
      status: 'sanitizing',
      public_preview_token: token,
      source: 'test',
      created_by: userId,
      session_id: session.id,
      is_public: 0,
    });

    console.log(`Created template: ${template.id} (status=${template.status})`);
    console.log('Starting sanitization — watch the Chrome window...');
    console.log('---');

    SanitizationOrchestrator.on('sanitization:step', (ev) => {
      console.log(`[step ${ev.step}] mode=${ev.mode}`);
    });

    SanitizationOrchestrator.on('sanitization:progress', (ev) => {
      console.log(`[progress] step=${ev.step} htmlLength=${ev.htmlLength}`);
    });

    const startTime = Date.now();
    const result = await SanitizationOrchestrator.startSanitization(
      session.id,
      SAMPLE_HTML,
      session.initial_prompt,
      null,
      userId
    );
    const elapsed = Date.now() - startTime;

    console.log('---');
    console.log(`Finished in ${elapsed}ms`);
    console.log(`Success: ${result.success}`);
    if (!result.success) {
      console.log(`Error: ${result.error}`);
    }
    if (result.metadata) {
      console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    }

    const updated = await TemplateRepository.findById(template.id);
    const outPath = path.join(__dirname, '..', 'data', `sanitization-test-${template.id}.html`);
    fs.writeFileSync(outPath, updated.sanitized_html || updated.html || '');
    console.log(`Sanitized HTML saved to: ${outPath}`);

    const logPath = path.join(__dirname, '..', 'data', `sanitization-test-${template.id}.json`);
    fs.writeFileSync(logPath, JSON.stringify(result.log, null, 2));
    console.log(`Log saved to: ${logPath}`);
  } finally {
    await BridgeAdapter.disconnect();
    closeDatabase();
    // Force exit so Playwright's CDP transport doesn't keep the process alive.
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
