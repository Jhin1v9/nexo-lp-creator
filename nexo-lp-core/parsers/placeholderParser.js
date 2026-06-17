/**
 * placeholderParser.js — NEXO Landing Page Creator v3.0
 * Finds {{PLACEHOLDER}} patterns, replaces with values, supports default values.
 * Format: {{BRAND_NAME:Your Brand}} — "Your Brand" is the default.
 */

// ─── Regex for placeholders ─────────────────────────────────────────
// Matches: {{KEY}}, {{KEY:default value}}, {{KEY: value with spaces }}
const PLACEHOLDER_REGEX = /\{\{([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}\}/g;

/**
 * Find all placeholders in a string.
 * @param {string} content - The content to scan
 * @returns {Array} List of placeholder objects: { key, defaultValue, fullMatch }
 */
function findPlaceholders(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const placeholders = [];
  let match;

  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    placeholders.push({
      key: match[1].trim(),
      defaultValue: match[2] !== undefined ? match[2].trim() : null,
      fullMatch: match[0],
      index: match.index,
    });
  }

  // Reset regex lastIndex
  PLACEHOLDER_REGEX.lastIndex = 0;

  // Deduplicate by key
  const seen = new Set();
  return placeholders.filter((p) => {
    if (seen.has(p.key)) return false;
    seen.add(p.key);
    return true;
  });
}

/**
 * Replace placeholders in content with values from a data object.
 * @param {string} content - Content with {{PLACEHOLDER}} patterns
 * @param {Object} values - Key-value pairs for replacement
 * @param {Object} options - { keepUnknown: boolean, onMissing: Function }
 * @returns {string} Content with placeholders replaced
 */
function replacePlaceholders(content, values = {}, options = {}) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const { keepUnknown = false, onMissing = null } = options;

  return content.replace(PLACEHOLDER_REGEX, (fullMatch, key, defaultValue) => {
    const cleanKey = key.trim();
    const cleanDefault = defaultValue !== undefined ? defaultValue.trim() : null;

    // 1. Use provided value if available
    if (values.hasOwnProperty(cleanKey) && values[cleanKey] !== null && values[cleanKey] !== undefined) {
      return values[cleanKey];
    }

    // 2. Use default value from placeholder syntax
    if (cleanDefault !== null && cleanDefault !== '') {
      return cleanDefault;
    }

    // 3. Custom missing handler
    if (onMissing && typeof onMissing === 'function') {
      const result = onMissing(cleanKey, fullMatch);
      if (result !== undefined) return result;
    }

    // 4. Keep unknown or return empty
    if (keepUnknown) {
      return fullMatch;
    }

    // 5. Return empty string for unknown placeholders
    return '';
  });
}

/**
 * Fill a template by replacing all placeholders, using defaults where no value provided.
 * @param {string} template - Template string with placeholders
 * @param {Object} values - Values to substitute
 * @returns {Object} { content, replaced, remaining, stats }
 */
function fillTemplate(template, values = {}) {
  const placeholders = findPlaceholders(template);
  const replacedKeys = [];
  const remainingKeys = [];

  const content = template.replace(PLACEHOLDER_REGEX, (fullMatch, key, defaultValue) => {
    const cleanKey = key.trim();
    const cleanDefault = defaultValue !== undefined ? defaultValue.trim() : null;

    if (values.hasOwnProperty(cleanKey) && values[cleanKey] !== null && values[cleanKey] !== undefined) {
      replacedKeys.push(cleanKey);
      return values[cleanKey];
    }

    if (cleanDefault !== null && cleanDefault !== '') {
      remainingKeys.push({ key: cleanKey, usedDefault: true, defaultValue: cleanDefault });
      return cleanDefault;
    }

    remainingKeys.push({ key: cleanKey, usedDefault: false, defaultValue: null });
    return fullMatch; // keep unknown
  });

  // Reset regex
  PLACEHOLDER_REGEX.lastIndex = 0;

  // Check remaining after replacement
  const stillRemaining = findPlaceholders(content);

  return {
    content,
    replaced: [...new Set(replacedKeys)],
    defaulted: remainingKeys.filter((r) => r.usedDefault).map((r) => r.key),
    unresolved: stillRemaining.map((p) => p.key),
    isComplete: stillRemaining.length === 0,
    stats: {
      totalPlaceholders: placeholders.length,
      replaced: replacedKeys.length,
      defaulted: remainingKeys.filter((r) => r.usedDefault).length,
      unresolved: stillRemaining.length,
    },
  };
}

/**
 * Create a placeholder schema from a template string.
 * @param {string} content - Template content
 * @returns {Array} Schema definitions: { key, defaultValue, required, description }
 */
function extractSchema(content) {
  const placeholders = findPlaceholders(content);

  return placeholders.map((p) => ({
    key: p.key,
    defaultValue: p.defaultValue,
    required: p.defaultValue === null,
    description: generateDescription(p.key),
  }));
}

/**
 * Generate a human-readable description from a key name.
 * @param {string} key
 * @returns {string}
 */
function generateDescription(key) {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate that all required placeholders have values.
 * @param {string} content - Template content
 * @param {Object} values - Provided values
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function validatePlaceholders(content, values = {}) {
  const placeholders = findPlaceholders(content);
  const missing = [];

  placeholders.forEach((p) => {
    // Required if no default and no value provided
    if (p.defaultValue === null && !values.hasOwnProperty(p.key)) {
      missing.push(p.key);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
    total: placeholders.length,
    provided: placeholders.filter((p) => values.hasOwnProperty(p.key)).length,
  };
}

/**
 * Get a flat list of unique placeholder keys from content.
 * @param {string} content
 * @returns {string[]}
 */
function getPlaceholderKeys(content) {
  return findPlaceholders(content).map((p) => p.key);
}

module.exports = {
  findPlaceholders,
  replacePlaceholders,
  fillTemplate,
  extractSchema,
  validatePlaceholders,
  getPlaceholderKeys,
  PLACEHOLDER_REGEX,
};
