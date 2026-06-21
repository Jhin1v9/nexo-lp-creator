const { queryOne, query, run } = require('../sqlite');

class AppSettingsRepository {
  _validateKey(key) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
  }

  _deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') {
      return Number.isNaN(a) && Number.isNaN(b);
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => this._deepEqual(item, b[i]));
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        this._deepEqual(a[key], b[key])
    );
  }

  _isSerializable(value) {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      throw new TypeError('value is not JSON-serializable');
    }
    const parsed = JSON.parse(serialized);
    if (!this._deepEqual(value, parsed)) {
      throw new TypeError('value is not JSON-serializable');
    }
    return serialized;
  }

  async get(key, defaultValue = null) {
    this._validateKey(key);
    const row = await queryOne('SELECT value FROM app_settings WHERE key = ?', [key]);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      // invalid JSON returns defaultValue
      return defaultValue;
    }
  }

  async set(key, value) {
    this._validateKey(key);
    if (value === undefined) {
      throw new TypeError('value must not be undefined');
    }
    const serialized = this._isSerializable(value);
    const now = new Date().toISOString();
    await run(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, serialized, now]
    );
    return value;
  }

  async getAll(prefix = null) {
    if (prefix !== null && (typeof prefix !== 'string' || prefix.length === 0)) {
      throw new TypeError('prefix must be a non-empty string when provided');
    }
    const sql = prefix
      ? "SELECT key, value FROM app_settings WHERE key LIKE ? || '%' ESCAPE '\\'"
      : 'SELECT key, value FROM app_settings';
    const params = prefix
      ? [prefix.replace(/[%_]/g, '\\$&')]
      : [];
    const rows = await query(sql, params);
    return rows.reduce((acc, row) => {
      try {
        acc[row.key] = JSON.parse(row.value);
      } catch {
        // invalid JSON falls back to null
        acc[row.key] = null;
      }
      return acc;
    }, {});
  }
}

module.exports = new AppSettingsRepository();
