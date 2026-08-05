const { initializeDatabase, closeDatabase } = require("../nexo-lp-server/models/sqlite");
const bridge = require("../nexo-lp-server/services/lpStoreBridgeService");

(async () => {
  await initializeDatabase();
  try {
    const result = await bridge.syncAllExistingTemplatesToStore(5);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    closeDatabase();
  }
})();
