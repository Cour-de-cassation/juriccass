require('../modules/env');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  jobName: require('path').basename(__filename, '.js'),
});

async function main() {
  logger.info('Start');
  logger.info('(nothing to do (yet))');
  logger.info('End');
  process.exit(0);
}

main();
