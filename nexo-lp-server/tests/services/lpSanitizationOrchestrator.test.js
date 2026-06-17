/**
 * NEXO Landing Page Creator v3.0 - Sanitization Orchestrator Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-sanitization-orchestrator.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

jest.mock('../../services/lpBridgeAdapter.cjs', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('../../services/lpPreviewService', () => ({
  updatePublicPreview: jest.fn(),
}));

jest.mock('../../services/lpTemplateScreenshotService', () => ({
  captureTemplateScreenshot: jest.fn().mockResolvedValue('/preview/thumbnails/tpl-test.png'),
}));

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const BridgeAdapter = require('../../services/lpBridgeAdapter.cjs');
const PreviewService = require('../../services/lpPreviewService');
const TemplateScreenshotService = require('../../services/lpTemplateScreenshotService');
const SanitizationOrchestrator = require('../../services/lpSanitizationOrchestrator');

describe('lpSanitizationOrchestrator', () => {
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    BridgeAdapter.sendMessage.mockClear();
    PreviewService.updatePublicPreview.mockClear();
    TemplateScreenshotService.captureTemplateScreenshot.mockClear();
  });

  async function createTemplate(sessionId, overrides = {}) {
    return TemplateRepository.create({
      name: 'Test Template',
      description: 'A test template',
      category: 'landing',
      stack: 'static-html-tailwind',
      html: '<h1>Original HTML</h1>',
      session_id: sessionId,
      public_preview_token: `pub-${sessionId}`,
      status: 'sanitizing',
      ...overrides,
    });
  }

  test('sanitizes and marks template available when review is OK', async () => {
    const sessionId = 'sess-ok-001';
    const template = await createTemplate(sessionId);
    const originalHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Acme Corp</title></head><body><h1>Acme Corp</h1><p>Welcome to our site.</p><section><h2>Features</h2><ul><li>Fast</li><li>Secure</li></ul></section></body></html>';
    const sanitizedHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>NEXO Digital</title></head><body><h1>NEXO Digital</h1><p>We create digital experiences that convert.</p><section><h2>Features</h2><ul><li>Fast</li><li>Secure</li></ul></section></body></html>';
    const metadata = {
      category: 'saas',
      subcategory: 'b2b-saas',
      tags: ['modern'],
      niche: 'B2B SaaS',
      audience: 'Startups',
      difficulty: 'beginner',
      features: ['Hero'],
      colors: ['#6366F1'],
      style: 'modern',
      seoKeywords: ['saas'],
      badges: ['Trending'],
      whyBuy: 'Great template',
      useCases: ['Launch'],
    };

    BridgeAdapter.sendMessage
      .mockResolvedValueOnce({ success: true, content: sanitizedHtml, mode: 'instant' })
      .mockResolvedValueOnce({
        success: true,
        content: JSON.stringify({ ok: true, corrections: [], metadata }),
        mode: 'thinking',
      });

    const result = await SanitizationOrchestrator.startSanitization(
      sessionId,
      originalHtml,
      '',
      'http://kimi.example.com/chat/1',
      'user-1'
    );

    expect(result.success).toBe(true);
    expect(result.templateId).toBe(template.id);
    expect(result.metadata.category).toBe('saas');

    const updated = await TemplateRepository.findById(template.id);
    expect(updated.status).toBe('available');
    expect(updated.is_public).toBe(1);
    expect(updated.sanitized_html).toBe(sanitizedHtml);
    expect(updated.html).toBe(sanitizedHtml);
    expect(updated.category).toBe('saas');
    expect(updated.subcategory).toBe('b2b-saas');
    expect(updated.metadata_json).toContain('"category":"saas"');

    expect(BridgeAdapter.sendMessage).toHaveBeenCalledTimes(2);
    expect(PreviewService.updatePublicPreview).toHaveBeenCalledWith(
      template.public_preview_token,
      sanitizedHtml
    );
    expect(TemplateScreenshotService.captureTemplateScreenshot).toHaveBeenCalledWith(
      template.id,
      template.public_preview_token
    );
  });

  test('applies corrections and marks template available', async () => {
    const sessionId = 'sess-correct-002';
    const template = await createTemplate(sessionId);
    const originalHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Acme Corp</title></head><body><h1>Acme Corp</h1><p>Welcome to our site.</p><section><h2>Features</h2><ul><li>Fast</li><li>Secure</li></ul></section></body></html>';
    const sanitizedHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>NEXO Digital</title></head><body><h1>NEXO Digital</h1><p>We create digital experiences that convert.</p><section><h2>Features</h2><ul><li>Fast</li><li>Secure</li></ul></section></body></html>';
    const refinedHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>NEXO Digital Refined</title></head><body><h1>NEXO Digital</h1><p>Refined landing page content with improved copy and spacing for better conversion.</p><section><h2>Features</h2><ul><li>Fast</li><li>Secure</li><li>Refined</li></ul></section></body></html>';
    const metadata = { category: 'landing' };

    BridgeAdapter.sendMessage
      .mockResolvedValueOnce({ success: true, content: sanitizedHtml, mode: 'instant' })
      .mockResolvedValueOnce({
        success: true,
        content: JSON.stringify({ ok: false, corrections: ['Add a tagline'], metadata }),
        mode: 'thinking',
      })
      .mockResolvedValueOnce({ success: true, content: refinedHtml, mode: 'thinking' });

    const result = await SanitizationOrchestrator.startSanitization(
      sessionId,
      originalHtml,
      '',
      'http://kimi.example.com/chat/2',
      'user-2'
    );

    expect(result.success).toBe(true);

    const updated = await TemplateRepository.findById(template.id);
    expect(updated.status).toBe('available');
    expect(updated.html).toBe(refinedHtml);
    expect(BridgeAdapter.sendMessage).toHaveBeenCalledTimes(3);
  });

  test('marks template failed when bridge throws', async () => {
    const sessionId = 'sess-fail-003';
    const template = await createTemplate(sessionId);

    BridgeAdapter.sendMessage.mockRejectedValue(new Error('Bridge disconnected'));

    const originalHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Acme Corp</title></head><body><h1>Acme Corp</h1><p>Contact us at hello@acme.com</p></body></html>';

    const result = await SanitizationOrchestrator.startSanitization(
      sessionId,
      originalHtml,
      '',
      'http://kimi.example.com/chat/3',
      'user-3'
    );

    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);

    const updated = await TemplateRepository.findById(template.id);
    expect(updated.status).toBe('available');
    expect(updated.is_public).toBe(1);
    expect(updated.html).not.toContain('acme.com');
    expect(updated.html).toContain('NEXO Digital');
  });
});
