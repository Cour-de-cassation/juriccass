require('../modules/env');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  jobName: require('path').basename(__filename, '.js'),
});
const { Collector } = require('../modules/collector');

async function main() {
  logger.info('Start');
  const decisions = await Collector.collectNewDecisions();

  if (decisions && decisions.collected && Array.isArray(decisions.collected) && decisions.collected.length > 0) {
    logger.info(`${decisions.collected.length} decision(s) collected`);
    await Collector.storeAndNormalizeNewDecisions(decisions.collected);
  } else {
    logger.info('No decision collected');
  }

  logger.info('End');
  process.exit(0);
}

main();
