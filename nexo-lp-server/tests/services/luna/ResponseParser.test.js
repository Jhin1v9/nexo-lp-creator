/**
 * ResponseParser tests — real parsing, no fallbacks.
 */

const { ResponseParser, ReviewValidationError } = require('../../../services/luna/ResponseParser.cjs');

describe('ResponseParser', () => {
  describe('cleanKimiHeaders', () => {
    test('strips markdown fences and Kimi headers', () => {
      const text = '```json\n{"score": 90}\n```';
      expect(ResponseParser.cleanKimiHeaders(text)).toBe('{"score": 90}');
    });

    test('strips JSON Copy header', () => {
      expect(ResponseParser.cleanKimiHeaders('JSON Copy\n{"score": 90}')).toBe('{"score": 90}');
    });

    test('strips 复制 header', () => {
      expect(ResponseParser.cleanKimiHeaders('JSON 复制\n{"score": 90}')).toBe('{"score": 90}');
    });
  });

  describe('extractJsonObject', () => {
    test('parses plain review JSON', () => {
      const review = { score: 90, issues: [], suggestions: [], passed: true };
      const parsed = ResponseParser.extractJsonObject(JSON.stringify(review));
      expect(parsed).toMatchObject(review);
    });

    test('parses JSON inside markdown code block', () => {
      const review = { score: 72, issues: [{ severity: 'error', message: 'Broken' }], suggestions: ['Fix'], passed: false };
      const text = `\`\`\`json\n${JSON.stringify(review)}\n\`\`\``;
      const parsed = ResponseParser.extractJsonObject(text);
      expect(parsed).toMatchObject(review);
    });

    test('parses JSON wrapped in explanatory text', () => {
      const review = { score: 55, issues: [{ severity: 'critical', message: 'Truncated' }], suggestions: ['Complete'], passed: false };
      const text = `Aqui está o review:\n${JSON.stringify(review)}\nEspero que ajude.`;
      const parsed = ResponseParser.extractJsonObject(text);
      expect(parsed).toMatchObject(review);
    });

    test('parses JSON with trailing commas', () => {
      const text = `{\n  "score": 72,\n  "issues": [{\n    "severity": "error",\n    "message": "Broken link",\n  },],\n  "passed": false,\n}`;
      const parsed = ResponseParser.extractJsonObject(text);
      expect(parsed.score).toBe(72);
      expect(parsed.issues).toHaveLength(1);
    });

    test('parses top-level issues array', () => {
      const issues = [{ severity: 'warning', message: 'Low contrast' }];
      const parsed = ResponseParser.extractJsonObject(JSON.stringify(issues));
      expect(parsed.issues).toEqual(issues);
    });

    test('normalizes old {ok, corrections} schema', () => {
      const text = JSON.stringify({ ok: false, corrections: ['Fix div', 'Add alt'], metadata: { category: 'saas' } });
      const parsed = ResponseParser.extractJsonObject(text);
      expect(parsed.passed).toBe(false);
      expect(parsed.issues).toHaveLength(2);
      expect(parsed.issues[0].severity).toBe('warning');
    });

    test('unwraps {"response": "..."} wrapper containing review JSON', () => {
      const review = { score: 80, issues: [{ severity: 'warning', message: 'X' }], passed: false };
      const wrapper = JSON.stringify({ response: JSON.stringify(review) });
      const parsed = ResponseParser.extractJsonObject(wrapper);
      expect(parsed).toMatchObject(review);
    });

    test('returns null for non-JSON text', () => {
      expect(ResponseParser.extractJsonObject('just plain text')).toBeNull();
    });
  });

  describe('extractReviewFromResponse', () => {
    test('returns valid review object', () => {
      const review = { score: 95, issues: [], suggestions: [], passed: true };
      const result = ResponseParser.extractReviewFromResponse(JSON.stringify(review));
      expect(result).toMatchObject(review);
      expect(result.rawResponse).toBe(JSON.stringify(review));
    });

    test('throws when response is empty', () => {
      expect(() => ResponseParser.extractReviewFromResponse('')).toThrow(ReviewValidationError);
    });

    test('throws when JSON cannot be parsed', () => {
      expect(() => ResponseParser.extractReviewFromResponse('not json')).toThrow(ReviewValidationError);
    });

    test('throws when score is invalid', () => {
      expect(() => ResponseParser.extractReviewFromResponse(JSON.stringify({ score: 150, issues: [], passed: true }))).toThrow(ReviewValidationError);
    });

    test('throws when passed=false but issues are empty', () => {
      const review = { score: 50, issues: [], suggestions: [], passed: false };
      expect(() => ResponseParser.extractReviewFromResponse(JSON.stringify(review))).toThrow(ReviewValidationError);
    });

    test('accepts passed=false with concrete issues', () => {
      const review = { score: 50, issues: [{ severity: 'error', message: 'Missing viewport' }], suggestions: [], passed: false };
      const result = ResponseParser.extractReviewFromResponse(JSON.stringify(review));
      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('extractHtmlFromResponse', () => {
    test('extracts HTML from markdown fence', () => {
      const html = '<!DOCTYPE html><html><body><h1>X</h1></body></html>';
      const text = `\`\`\`html\n${html}\n\`\`\``;
      expect(ResponseParser.extractHtmlFromResponse(text)).toBe(html);
    });

    test('slices HTML from raw response', () => {
      const html = '<!DOCTYPE html><html><body><h1>X</h1></body></html>';
      const text = `Some intro\n${html}\nSome outro`;
      expect(ResponseParser.extractHtmlFromResponse(text)).toBe(html);
    });

    test('strips HTML Copy header', () => {
      const html = '<!DOCTYPE html><html><body><h1>X</h1></body></html>';
      expect(ResponseParser.extractHtmlFromResponse(`HTML Copy\n${html}`)).toBe(html);
    });
  });
});
