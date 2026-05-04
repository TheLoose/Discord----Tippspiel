const { startScheduler } = require('../utils/scheduler');
const { startInternalServer } = require('../utils/internalServer');

module.exports = {
  name: 'ready',
  once: true,

  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('⚽ Sports Predictions', { type: 3 }); // 3 = Watching
    startScheduler(client);
    startInternalServer(client);
  }
};
