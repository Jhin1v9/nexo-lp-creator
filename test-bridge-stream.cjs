process.chdir('/home/jhin/luna/nexo-lp-creator/nexo-lp-server');
process.env.KIMI_BRIDGE_REUSE_USER_ID = 'true';
process.env.KIMI_BRIDGE_FIXED_USER_ID = 'nexo-lp-debug-stream';
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

  const userId = 'nexo-lp-debug-stream';

  // Force new chat
  const session = bridge.userSessions.get(userId);
  if (session && session.page) {
    await session.page.goto('https://www.kimi.com/?chat_enter_method=new_chat&lang=en', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
  }

  const stream = bridge.sendMessageStream(userId, 'Diga apenas "funcionou" sem mais nada.', { mode: 'instant', newChat: true });

  const start = Date.now();
  for await (const event of stream) {
    console.log(`[${Date.now() - start}ms]`, event.type, JSON.stringify(event).substring(0, 200));
    if (event.type === 'done') {
      console.log('FINAL RESPONSE:', event.response);
      break;
    }
  }

  await bridge.disconnect();
  process.exit(0);
})();
