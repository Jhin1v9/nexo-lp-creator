/**
 * NEXO Landing Page Creator v3.0 - Sanitization Service Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-sanitization.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

jest.mock('../../services/lpBridgeAdapter.cjs', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('../../services/lpPreviewService', () => ({
  updatePublicPreview: jest.fn(),
}));

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const BridgeAdapter = require('../../services/lpBridgeAdapter.cjs');
const PreviewService = require('../../services/lpPreviewService');
const SanitizationService = require('../../services/lpSanitizationService');

describe('lpSanitizationService', () => {
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
    BridgeAdapter.sendMessage.mockReset();
    PreviewService.updatePublicPreview.mockReset();
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
    const originalHtml = '<h1>Acme Corp</h1>';
    const sanitizedHtml = '<h1>Empresa NEXO Digital</h1>';

    BridgeAdapter.sendMessage
      .mockResolvedValueOnce({ success: true, content: sanitizedHtml, mode: 'instant' })
      .mockResolvedValueOnce({ success: true, content: 'OK', mode: 'thinking' });

    const result = await SanitizationService.startSanitization(
      sessionId,
      originalHtml,
      '',
      'http://kimi.example.com/chat/1',
      'user-1'
    );

    expect(result.success).toBe(true);
    expect(result.templateId).toBe(template.id);

    const updated = await TemplateRepository.findById(template.id);
    expect(updated.status).toBe('available');
    expect(updated.is_public).toBe(1);
    expect(updated.sanitized_html).toBe(sanitizedHtml);
    expect(updated.html).toBe(sanitizedHtml);

    const log = JSON.parse(updated.sanitization_log);
    expect(log.attempts).toHaveLength(2);
    expect(log.attempts[0].step).toBe('sanitize');
    expect(log.attempts[0].mode).toBe('instant');
    expect(log.attempts[1].step).toBe('review');
    expect(log.attempts[1].mode).toBe('thinking');

    expect(BridgeAdapter.sendMessage).toHaveBeenCalledTimes(2);
    expect(PreviewService.updatePublicPreview).toHaveBeenCalledWith(
      template.public_preview_token,
      sanitizedHtml
    );
  });

  test('retries and marks failed when review never OK', async () => {
    const sessionId = 'sess-fail-002';
    const template = await createTemplate(sessionId);
    const originalHtml = '<h1>Acme Corp</h1>';
    const sanitizedHtml = '<h1>Empresa NEXO Digital</h1>';

    // First sanitize + review, then 3 retry sanitize/review pairs
    for (let i = 0; i < 4; i++) {
      BridgeAdapter.sendMessage.mockResolvedValueOnce({
        success: true,
        content: sanitizedHtml,
        mode: 'instant',
      });
      BridgeAdapter.sendMessage.mockResolvedValueOnce({
        success: true,
        content: 'Ainda contém dados reais. Remova telefones e endereços.',
        mode: 'thinking',
      });
    }

    const result = await SanitizationService.startSanitization(
      sessionId,
      originalHtml,
      '',
      'http://kimi.example.com/chat/2',
      'user-2'
    );

    expect(result.success).toBe(false);
    expect(result.templateId).toBe(template.id);

    const updated = await TemplateRepository.findById(template.id);
    expect(updated.status).toBe('failed');
    expect(updated.is_public).toBe(0);
    expect(updated.html).toBe('<h1>Original HTML</h1>');
    expect(updated.sanitized_html).toBe(sanitizedHtml);

    const log = JSON.parse(updated.sanitization_log);
    expect(log.attempts).toHaveLength(8);
    expect(log.attempts.filter((a) => /^retry-\d+$/.test(a.step))).toHaveLength(3);
    expect(log.attempts.filter((a) => /^retry-review-\d+$/.test(a.step))).toHaveLength(3);

    expect(PreviewService.updatePublicPreview).not.toHaveBeenCalled();
  });
});
