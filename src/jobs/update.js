require('../modules/env');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  jobName: require('path').basename(__filename, '.js'),
});
const { DateTime } = require('luxon');
const { Collector } = require('../modules/collector');

async function main() {
  logger.info('Start');

  let now = DateTime.now();
  let lastDate;

  try {
    lastDate = DateTime.fromISO(
      fs.readFileSync(path.join(__dirname, '..', '..', 'settings', 'update.lastUpdate')).toString(),
    );
  } catch (ignore) {
    lastDate = now.minus({ days: 2 });
  }

  let decisions;

  decisions = await Collector.getUpdatedDecisions(lastDate);

  if (decisions && decisions.collected && Array.isArray(decisions.collected) && decisions.collected.length > 0) {
    logger.info(`${decisions.collected.length} decision(s) updated`);
    await Collector.storeAndNormalizeNewDecisions(decisions.collected, true);
    for (let i = 0; i < decisions.collected.length; i++) {
      let decision = decisions.collected[i].decision;
      let modifTime = DateTime.fromJSDate(decision.DT_MODIF);
      lastDate = DateTime.max(lastDate, modifTime);
    }
  } else {
    logger.info('No decision updated');
  }

  try {
    fs.writeFileSync(path.join(__dirname, '..', '..', 'settings', 'update.lastUpdate'), lastDate.toISO());
  } catch (e) {
    logger.error(e);
  }

  logger.info('End');
  process.exit(0);
}

main();
