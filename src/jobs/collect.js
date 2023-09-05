require('../modules/env');
const { Logger } = require('../modules/logger');
const jobId = require('path').basename(__filename, '.js');
const logger = Logger.child({
  jobName: jobId,
});

const { Database, ObjectId } = require('../modules/database');

async function main() {
  logger.info('test');

  // const test = await Database.findOne('si.jurinet', 'SELECT * FROM DOCUMENT WHERE ID_DOCUMENT=1899265');
  const test = await Database.findOne('sder.rawJurinet', { _id: 1899265 });
  console.log(test);
}

main();
