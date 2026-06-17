process.chdir('/home/jhin/luna/nexo-lp-creator/nexo-lp-server');
process.env.KIMI_BRIDGE_REUSE_USER_ID = 'false';
process.env.KIMI_CDP_PORT = '9226';
process.env.KIMI_CDP_URL = 'http://127.0.0.1:9226';
process.env.KIMI_MAX_PAGES = '1';
process.env.KIMI_CHROME_USER_DATA_DIR = '/home/jhin/.luna/nexo-lp-chrome-profile';

const BridgeAdapter = require('/home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/lpBridgeAdapter.cjs');

(async () => {
  const context = BridgeAdapter.initializeContext('debug-session-clean');
  try {
    const response = await BridgeAdapter.sendMessage(context, 'Gere um HTML simples para um site de pao de queijo. Responda apenas com o codigo HTML completo.', { stack: 'static-html-tailwind', phase: 'code' });
    console.log('Response length:', response.content.length);
    console.log('First 300 chars:', response.content.substring(0, 300));
    const GenerationService = require('/home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/lpGenerationService.js');
    const html = GenerationService.extractHtmlFromResponse(response.content);
    console.log('Extracted HTML length:', html.length);
    console.log('HTML first 300 chars:', html.substring(0, 300));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
