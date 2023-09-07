require('../modules/env');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  jobName: require('path').basename(__filename, '.js'),
});
const { Collector } = require('../modules/collector');

async function main() {
  let decisions;

  if (process.env.USE_DBSDER_API === 'ON') {
    logger.info('Collect using DBSDER API');
    decisions = await Collector.collectNewDecisionsFromAPI();
    console.log(decisions);
  } else {
    logger.info('Collect using direct DB access');
    decisions = await Collector.collectNewDecisionsFromDB();
  }

  process.exit(0);
}

main();
