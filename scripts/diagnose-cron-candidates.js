const { initializeDatabase, query, closeDatabase } = require('../nexo-lp-server/models/sqlite');

function isValidHtml(html) {
  if (!html || typeof html !== 'string' || html.length < 15000) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('<!doctype html>') &&
    lower.includes('<html') &&
    lower.includes('</html>') &&
    lower.includes('<body')
  );
}

function isTestSession(session) {
  const prompt = (session.initial_prompt || '').toLowerCase();
  const uid = (session.user_id || '').toLowerCase();
  return prompt.includes('test') || uid.startsWith('test-') || uid.startsWith('anonymous-');
}

async function main() {
  await initializeDatabase();

  const all = await query(`
    SELECT s.*, t.id as template_id
    FROM sessions s
    LEFT JOIN templates t ON t.session_id = s.id
  `);

  let total = 0;
  let hasTemplate = 0;
  let noHtml = 0;
  let shortHtml = 0;
  let invalidHtml = 0;
  let testSession = 0;
  let wrongStatus = 0;
  let candidate = 0;

  for (const s of all) {
    total++;
    if (s.template_id) { hasTemplate++; continue; }
    if (!s.current_html) { noHtml++; continue; }
    if (s.current_html.length < 15000) { shortHtml++; continue; }
    if (!isValidHtml(s.current_html)) { invalidHtml++; continue; }
    if (isTestSession(s)) { testSession++; continue; }
    if (!['preview', 'deployed'].includes(s.status)) { wrongStatus++; continue; }
    candidate++;
  }

  console.log('Total sessions:', total);
  console.log('Already have template:', hasTemplate);
  console.log('No current_html:', noHtml);
  console.log('HTML < 15000 chars:', shortHtml);
  console.log('HTML fails doctype/body checks:', invalidHtml);
  console.log('Test/anonymous session:', testSession);
  console.log('Status not preview/deployed:', wrongStatus);
  console.log('CRON CANDIDATES:', candidate);

  const byStatus = {};
  for (const s of all) {
    if (!s.template_id && s.current_html && s.current_html.length >= 15000 && isValidHtml(s.current_html) && !isTestSession(s)) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    }
  }
  console.log('Valid non-test sessions without template by status:', byStatus);

  closeDatabase();
}

main().catch((err) => { console.error(err); process.exit(1); });
