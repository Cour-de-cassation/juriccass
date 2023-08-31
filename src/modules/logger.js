require('./env');
const pino = require('pino');

const logger = pino({
  name: process.env.APP_ID,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

module.exports.logger = logger;
