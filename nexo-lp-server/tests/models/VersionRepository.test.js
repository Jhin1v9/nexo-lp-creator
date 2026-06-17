/**
 * NEXO Landing Page Creator v3.0 - VersionRepository Tests
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const SessionRepository = require('../../models/repositories/SessionRepository');
const VersionRepository = require('../../models/repositories/VersionRepository');

describe('VersionRepository', () => {
  const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test.db');

  beforeAll(async () => {
    process.env.NEXO_LP_DB_PATH = testDbPath;
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

  let sessionId;

  beforeEach(async () => {
    const session = await SessionRepository.create({
      userId: 'test-user',
      initialPrompt: 'test version history',
      stack: 'static-html-tailwind',
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await SessionRepository.delete(sessionId);
  });

  test('creates and retrieves a version for a session', async () => {
    const version = await VersionRepository.create({
      sessionId,
      html: '<html>v1</html>',
      changeSummary: 'Initial version',
      metadata: { phase: 'code' },
    });

    expect(version.id).toBeDefined();
    expect(version.session_id).toBe(sessionId);
    expect(version.html).toBe('<html>v1</html>');
    expect(version.change_summary).toBe('Initial version');

    const found = await VersionRepository.findById(version.id);
    expect(found.html).toBe('<html>v1</html>');
  });

  test('lists versions ordered by version_number descending', async () => {
    await VersionRepository.create({ sessionId, html: 'v1', changeSummary: 'first' });
    await VersionRepository.create({ sessionId, html: 'v2', changeSummary: 'second' });

    const versions = await VersionRepository.findBySessionId(sessionId);
    expect(versions).toHaveLength(2);
    expect(versions[0].html).toBe('v2');
    expect(versions[1].html).toBe('v1');
  });

  test('returns the latest version', async () => {
    await VersionRepository.create({ sessionId, html: 'v1', changeSummary: 'first' });
    await VersionRepository.create({ sessionId, html: 'v2', changeSummary: 'second' });

    const latest = await VersionRepository.findLatest(sessionId);
    expect(latest.html).toBe('v2');
    expect(latest.version_number).toBe(2);
  });

  test('rollback restores html to session and returns the version', async () => {
    const v1 = await VersionRepository.create({ sessionId, html: '<html>v1</html>', changeSummary: 'first' });
    await SessionRepository.updateGeneratedCode(sessionId, { html: '<html>current</html>' });

    const rolledBack = await VersionRepository.rollback(sessionId, v1.id);
    expect(rolledBack.html).toBe('<html>v1</html>');

    const session = await SessionRepository.findById(sessionId);
    expect(session.current_html).toBe('<html>v1</html>');
  });

  test('deletes a version', async () => {
    const v = await VersionRepository.create({ sessionId, html: 'v1', changeSummary: 'first' });
    await VersionRepository.delete(v.id);

    const found = await VersionRepository.findById(v.id);
    expect(found).toBeNull();
  });
});
