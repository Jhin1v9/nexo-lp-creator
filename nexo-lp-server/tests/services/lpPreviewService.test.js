/**
 * NEXO Landing Page Creator v3.0 - Preview Service Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-preview.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const previewService = require('../../services/lpPreviewService');

describe('lpPreviewService - public previews', () => {
  const createdTokens = [];

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

  afterEach(async () => {
    for (const token of createdTokens) {
      const filePath = previewService.getPublicPreviewPath(token);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    createdTokens.length = 0;
  });

  test('generatePublicToken returns a pub- prefixed token', () => {
    const token = previewService.generatePublicToken();
    expect(typeof token).toBe('string');
    expect(token.startsWith('pub-')).toBe(true);
  });

  test('publishPublicPreview creates a file and returns the correct URL', async () => {
    const token = previewService.generatePublicToken();
    createdTokens.push(token);

    const result = await previewService.publishPublicPreview(
      'sess-test',
      '<h1>Hello Public</h1>',
      token
    );

    expect(result.token).toBe(token);
    expect(result.url).toBe(`/preview/public/${token}.html`);

    const filePath = previewService.getPublicPreviewPath(token);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('<h1>Hello Public</h1>');
    expect(content.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  test('updatePublicPreview overwrites an existing public preview file', async () => {
    const token = previewService.generatePublicToken();
    createdTokens.push(token);

    await previewService.publishPublicPreview(
      'sess-test',
      '<p>Original content</p>',
      token
    );

    const result = await previewService.updatePublicPreview(
      token,
      '<p>Updated content</p>'
    );

    expect(result.token).toBe(token);
    expect(result.url).toBe(`/preview/public/${token}.html`);

    const filePath = previewService.getPublicPreviewPath(token);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('<p>Updated content</p>');
    expect(content).not.toContain('<p>Original content</p>');
  });

  test('updatePublicPreview throws when the public preview does not exist', async () => {
    const token = previewService.generatePublicToken();

    await expect(
      previewService.updatePublicPreview(token, '<p>New</p>')
    ).rejects.toThrow(`Public preview not found: ${token}`);
  });

  test('normalizeImageUrls replaces invalid Unsplash URLs with AI-generated fallback images', () => {
    const html = '<img src="https://images.unsplash.com/photo--4d71bcdd2085?w=1920&q=80" alt="Café de especialidad"><div style="background-image:url(https://images.unsplash.com/photo-abc?w=600)"></div>';
    const normalized = previewService.normalizeImageUrls(html);

    expect(normalized).toContain('https://image.pollinations.ai/prompt/');
    expect(normalized).toContain('https://picsum.photos/seed/');
    expect(normalized).not.toContain('images.unsplash.com');
  });

  test('publishPublicPreview normalizes image URLs in saved HTML', async () => {
    const token = previewService.generatePublicToken();
    createdTokens.push(token);

    await previewService.publishPublicPreview(
      'sess-test',
      '<img src="https://images.unsplash.com/photo--fake123?w=800">',
      token
    );

    const filePath = previewService.getPublicPreviewPath(token);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('picsum.photos');
    expect(content).not.toContain('images.unsplash.com');
  });
});
