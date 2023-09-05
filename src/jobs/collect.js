require('../modules/env');
const { Logger } = require('../modules/logger');
const jobId = require('path').basename(__filename, '.js');
const logger = Logger.child({
  jobName: jobId,
});
const { Collector } = require('../modules/collector');

async function main() {
  let decisions;

  if (process.env.USE_DBSDER_API) {
    logger.info('Collect using DBSDER API');
    decisions = await Collector.collectNewDecisionsFromAPI();
  } else {
    logger.info('Collect using direct DB access');
    decisions = await Collector.collectNewDecisionsFromDB();
  }
}

main();
