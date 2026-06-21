/**
 * NEXO Landing Page Creator v3.0 - Review prompt / response tests
 *
 * These tests pin down the review-phase prompt and the parsing logic so we can
 * quickly detect when the prompt becomes empty or loses required JSON fields.
 */

process.env.NODE_ENV = 'test';

jest.mock('../../services/lpBugDetectorService', () => ({
  detect: jest.fn().mockResolvedValue({
    passed: false,
    issues: [{ severity: 'warning', message: 'Mock local bug-detector issue' }],
  }),
}));

const { PHASE_PROMPTS } = require('../../services/lpGenerationService');
const GenerationService = require('../../services/lpGenerationService');

describe('review prompt', () => {
  test('contains the HTML, required JSON schema fields, and SEO criteria', () => {
    const html = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
    const prompt = PHASE_PROMPTS.review(html);

    expect(prompt).toContain('HTML TO REVIEW:');
    expect(prompt).toContain(html);

    // Required JSON schema fields with concrete examples (not empty).
    expect(prompt).toMatch(/"score":\s*\d+/);
    expect(prompt).toContain('"issues":');
    expect(prompt).toContain('"suggestions":');
    expect(prompt).toMatch(/"passed":\s*(true|false)/);

    // SEO must be evaluated.
    expect(prompt).toMatch(/SEO|seo/);

    // Must require concrete issues when the review fails.
    expect(prompt).toMatch(/If "passed": false, "issues" MUST explain why/i);
  });
});

describe('parseReviewResponse', () => {
  const html = '<!DOCTYPE html><html><head><title>T</title></head><body><h1>T</h1></body></html>';

  test('preserves rawResponse and parsed issues when response is valid', async () => {
    const content = JSON.stringify({
      score: 95,
      issues: [{ severity: 'info', message: 'Minor improvement possible' }],
      suggestions: ['Add alt text'],
      passed: true,
    });

    const result = await GenerationService.parseReviewResponse(content, html, 'sess-review-ok');

    expect(result.passed).toBe(true);
    expect(result.score).toBe(95);
    expect(result.issues).toHaveLength(1);
    expect(result.rawResponse).toBe(content);
  });

  test('throws when passed=false but issues array is empty', () => {
    const content = JSON.stringify({
      score: 50,
      issues: [],
      suggestions: [],
      passed: false,
    });

    expect(() => GenerationService.parseReviewResponse(content, html, 'sess-review-fail')).toThrow(
      /Review marked as failed but provided no concrete issues/
    );
  });

  test('throws when response cannot be parsed as JSON', () => {
    const content = 'This is not valid JSON';

    expect(() => GenerationService.parseReviewResponse(content, html, 'sess-review-raw')).toThrow(
      /Could not extract valid review JSON/
    );
  });
});
