require('../modules/env');
const { logger } = require('../modules/logger');
const jobId = require('path').basename(__filename, '.js');
const log = logger.child({
  module: jobId,
});
