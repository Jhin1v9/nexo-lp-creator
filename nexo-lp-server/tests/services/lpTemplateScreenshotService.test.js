/**
 * NEXO Landing Page Creator v3.0 - Template Screenshot Service Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-screenshot.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.KIMI_CDP_URL = '';

const mockScreenshot = jest.fn();
const mockGoto = jest.fn();
const mockWaitForTimeout = jest.fn();
const mockClose = jest.fn();
const mockNewPage = jest.fn();
const mockNewContext = jest.fn();
const mockBrowserClose = jest.fn();

jest.mock('playwright', () => ({
  chromium: {
    connectOverCDP: jest.fn(),
    launch: jest.fn().mockResolvedValue({
      newContext: mockNewContext.mockResolvedValue({
        newPage: mockNewPage.mockResolvedValue({
          goto: mockGoto.mockResolvedValue({}),
          waitForTimeout: mockWaitForTimeout.mockResolvedValue({}),
          screenshot: mockScreenshot.mockResolvedValue({}),
          close: mockClose.mockResolvedValue({}),
        }),
      }),
      close: mockBrowserClose.mockResolvedValue({}),
    }),
  },
}));

const ScreenshotService = require('../../services/lpTemplateScreenshotService');

describe('lpTemplateScreenshotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('captures screenshot and returns thumbnail URL', async () => {
    const templateId = 'tpl-screenshot-001';
    const token = 'pub-token-001';

    const url = await ScreenshotService.captureTemplateScreenshot(templateId, token);

    expect(url).toBe(`/preview/thumbnails/${templateId}.png`);
    expect(mockGoto).toHaveBeenCalledWith(
      expect.stringContaining(`/preview/public/${token}.html`),
      { waitUntil: 'networkidle', timeout: 60000 }
    );
    expect(mockScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining(`${templateId}.png`),
        fullPage: false,
      })
    );
  });

  test('throws when templateId is missing', async () => {
    await expect(ScreenshotService.captureTemplateScreenshot(null, 'token'))
      .rejects.toThrow('templateId is required');
  });

  test('throws when publicPreviewToken is missing', async () => {
    await expect(ScreenshotService.captureTemplateScreenshot('tpl', null))
      .rejects.toThrow('publicPreviewToken is required');
  });
});
