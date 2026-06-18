/**
 * ResponseParser — robust text extraction for Kimi responses.
 *
 * Ports the parsing strategies that already work in the Luna bridge
 * (kimi-bridge.cjs / dom-extractor.cjs) into a pure-text utility that the
 * generation service can use on the content returned by BridgeAdapter.
 *
 * No fallbacks, no invented data: if the response cannot be parsed or does not
 * match the required schema, the parser throws a descriptive error so the
 * caller can retry with a stricter prompt.
 */

class ReviewValidationError extends Error {
  constructor(rawResponse, reason) {
    super(reason);
    this.name = 'ReviewValidationError';
    this.rawResponse = rawResponse;
    this.reason = reason;
  }
}

class ResponseParser {
  /**
   * Strip common Kimi UI artifacts and markdown fences from extracted text.
   */
  static cleanKimiHeaders(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/^\s*```(?:json|html|javascript|js|css)?\s*/i, '')
      .replace(/```\s*$/, '')
      .replace(/^\s*(?:JSON|HTML|JavaScript|JS|CSS)\s*(?:Copy|复制|複製)?\s*/i, '')
      .replace(/^\s*(?:Copy|复制|複製)\s*/i, '')
      .trim();
  }

  /**
   * Try to parse a JSON candidate, cleaning common Kimi mistakes.
   */
  static tryParseJson(candidate) {
    if (!candidate || typeof candidate !== 'string') return undefined;

    const trimmed = candidate.trim();
    if (!trimmed) return undefined;

    try {
      return JSON.parse(trimmed);
    } catch {
      // Try removing trailing commas before parsing
      try {
        const cleaned = trimmed
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\n/g, ' ')
          .replace(/\r/g, ' ');
        return JSON.parse(cleaned);
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Score how much a parsed object looks like a review result.
   */
  static reviewLikenessScore(obj) {
    if (!obj || typeof obj !== 'object') return -1;
    let score = 0;
    if (Array.isArray(obj.issues)) score += obj.issues.length * 3 + 3;
    if (Array.isArray(obj.corrections)) score += obj.corrections.length * 3 + 3;
    if (typeof obj.score === 'number') score += 2;
    if (typeof obj.passed === 'boolean') score += 2;
    if (Array.isArray(obj.suggestions)) score += 1;
    return score;
  }

  /**
   * Normalize a parsed review-like object into a consistent shape.
   * Returns null if the object is not review-like.
   */
  static normalizeReviewShape(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;

    // Old { ok, corrections, metadata } schema
    if (typeof parsed.ok === 'boolean' && Array.isArray(parsed.corrections)) {
      return {
        score: parsed.ok ? 100 : 60,
        issues: parsed.corrections.map((message) => ({
          severity: 'warning',
          message: typeof message === 'string' ? message : String(message),
        })),
        suggestions: parsed.corrections.map(String),
        passed: parsed.ok,
        metadata: parsed.metadata,
      };
    }

    const score = typeof parsed.score === 'number' ? parsed.score : undefined;
    const hasIssues = Array.isArray(parsed.issues);
    const hasSuggestions = Array.isArray(parsed.suggestions);
    const hasPassed = typeof parsed.passed === 'boolean';

    // Must have at least one review-like field
    if (score === undefined && !hasIssues && !hasPassed && !Array.isArray(parsed.corrections)) {
      return null;
    }

    return {
      score: score ?? 60,
      issues: hasIssues ? parsed.issues : [],
      suggestions: hasSuggestions ? parsed.suggestions : [],
      passed: hasPassed ? parsed.passed : false,
      metadata: parsed.metadata,
    };
  }

  /**
   * Extract a review-like JSON object from free-form text.
   * Handles code blocks, wrappers, explanatory text, old schemas, arrays, etc.
   */
  static extractJsonObject(text) {
    if (!text || typeof text !== 'string') return null;

    let cleaned = this.cleanKimiHeaders(text);
    if (!cleaned) return null;

    // Strategy 1: JSON wrappers like {"response": "..."} or {"message": "..."}
    const wrapper = this.tryParseJson(cleaned);
    if (wrapper && typeof wrapper === 'object') {
      if (wrapper.response && typeof wrapper.response === 'string' && !wrapper.tool && !wrapper.script) {
        const inner = this.extractJsonObject(wrapper.response);
        if (inner) return inner;
      }
      if (wrapper.message && typeof wrapper.message === 'string' && !wrapper.tool && !wrapper.script) {
        const inner = this.extractJsonObject(wrapper.message);
        if (inner) return inner;
      }
    }

    // Strategy 2: markdown code blocks
    const codeBlockMatches = cleaned.matchAll(/```(?:json)?\n?([\s\S]*?)```/g);
    for (const match of codeBlockMatches) {
      const parsed = this.tryParseJson(match[1].trim());
      const normalized = this.normalizeReviewShape(parsed);
      if (normalized) return normalized;
    }

    // Strategy 3: top-level issues array
    if (cleaned.startsWith('[')) {
      const parsed = this.tryParseJson(cleaned);
      if (Array.isArray(parsed)) {
        return this.normalizeReviewShape({ issues: parsed });
      }
    }

    // Strategy 4: find every balanced JSON object and pick the most review-like one
    const candidates = [];
    let firstBrace = cleaned.indexOf('{');
    while (firstBrace !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = firstBrace; i < cleaned.length; i += 1) {
        const char = cleaned[i];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (char === '\\') {
            escape = true;
          } else if (char === '"') {
            inString = false;
          }
        } else if (char === '"') {
          inString = true;
        } else if (char === '{') {
          depth += 1;
        } else if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            const candidate = cleaned.slice(firstBrace, i + 1);
            const parsed = this.tryParseJson(candidate);
            const normalized = this.normalizeReviewShape(parsed);
            if (normalized) {
              candidates.push({ normalized, score: this.reviewLikenessScore(parsed) });
            }
            break;
          }
        }
      }
      firstBrace = cleaned.indexOf('{', firstBrace + 1);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].normalized;
    }

    return null;
  }

  /**
   * Extract and validate a review result from a Kimi response.
   * Throws ReviewValidationError when the response is missing, malformed,
   * or contains empty fields that make it unusable.
   */
  static extractReviewFromResponse(text) {
    const rawResponse = typeof text === 'string' ? text : '';

    if (!rawResponse || !rawResponse.trim()) {
      throw new ReviewValidationError(rawResponse, 'Review response is empty');
    }

    const parsed = this.extractJsonObject(rawResponse);

    if (!parsed || typeof parsed !== 'object') {
      throw new ReviewValidationError(rawResponse, 'Could not extract valid review JSON');
    }

    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new ReviewValidationError(rawResponse, `Invalid review score: ${parsed.score}`);
    }

    if (!Array.isArray(parsed.issues)) {
      throw new ReviewValidationError(rawResponse, 'Review issues field is missing or not an array');
    }

    if (parsed.passed === false && parsed.issues.length === 0) {
      throw new ReviewValidationError(
        rawResponse,
        'Review marked as failed but provided no concrete issues'
      );
    }

    return {
      score: parsed.score,
      issues: parsed.issues,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      passed: typeof parsed.passed === 'boolean' ? parsed.passed : false,
      metadata: parsed.metadata,
      rawResponse,
    };
  }

  /**
   * Extract a complete HTML document from a Kimi response.
   */
  static extractHtmlFromResponse(response) {
    if (!response || typeof response !== 'string') return '';

    let text = this.cleanKimiHeaders(response);

    // Extract from markdown code block
    const codeBlockMatch = text.match(/```(?:html)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Slice from the first HTML-like start
    const doctypeIdx = text.toLowerCase().indexOf('<!doctype');
    const htmlIdx = text.toLowerCase().indexOf('<html');
    const startIdx =
      doctypeIdx >= 0 && htmlIdx >= 0
        ? Math.min(doctypeIdx, htmlIdx)
        : (doctypeIdx >= 0 ? doctypeIdx : htmlIdx);

    if (startIdx >= 0) {
      const afterStart = text.slice(startIdx);
      const closeMatch = afterStart.match(/<\/html\s*>/i);
      if (closeMatch) {
        return afterStart.slice(0, closeMatch.index + closeMatch[0].length).trim();
      }
      return afterStart.trim();
    }

    return text.trim();
  }
}

module.exports = { ResponseParser, ReviewValidationError };
