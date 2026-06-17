process.chdir('/home/jhin/luna/nexo-lp-creator/nexo-lp-server');
process.env.KIMI_BRIDGE_REUSE_USER_ID = 'true';
process.env.KIMI_BRIDGE_FIXED_USER_ID = 'nexo-lp-debug';
process.env.KIMI_CDP_PORT = '9226';
process.env.KIMI_CDP_URL = 'http://127.0.0.1:9226';
process.env.KIMI_MAX_PAGES = '1';
process.env.KIMI_CHROME_USER_DATA_DIR = '/home/jhin/.luna/nexo-lp-chrome-profile';

const KimiBridgeModule = require('/home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/luna/kimi-bridge.cjs');
const { KimiBridge } = KimiBridgeModule;

(async () => {
  const bridge = new KimiBridge({
    cdpUrl: 'http://127.0.0.1:9226',
    maxPages: 1,
    debug: true,
  });
  await bridge.connect();

  const userId = 'nexo-lp-debug';
  const page = await bridge._getOrCreateUserPage(userId);
  console.log('Page URL after getOrCreate:', page.url());

  // Wait a bit for poller to start
  await new Promise(r => setTimeout(r, 2000));

  const poll = await bridge._pollThinkingAndResponse(page, userId);
  console.log('Poll result:', JSON.stringify(poll, null, 2).substring(0, 3000));

  await bridge.disconnect();
  process.exit(0);
})();
