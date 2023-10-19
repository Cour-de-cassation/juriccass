const { Database } = require('../modules/database');
const path = require('path');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  moduleName: require('path').basename(__filename, '.js'),
});

async function main() {
  const id = 1791514;
  const results = await Database.find(
    'si.jurinet',
    `SELECT *
    FROM ANALYSE
    WHERE ID_DOCUMENT = :id
    ORDER BY NUM_ANALYSE ASC`,
    [id],
  );
  for (let i = 0; i < results.length; i++) {
    logger.info(i);
    logger.info(JSON.stringify(results[i], null, 2));
  }
}

main();
