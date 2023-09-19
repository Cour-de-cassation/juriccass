const axios = require('axios');
const { Logger } = require('./logger');
const logger = Logger.child({
  moduleName: require('path').basename(__filename, '.js'),
});

class Indexing {
  constructor() {}

  async indexDecision(source, decision, duplicateId, message, error) {
    try {
      return await axios.post(`${process.env.INDEX_URI}/indexDecision`, {
        source: source,
        decision: decision,
        duplicateId: duplicateId,
        message: message,
        error: error,
      });
    } catch (e) {
      logger.error(e);
      return false;
    }
  }

  async indexAffaire(source, decision) {
    try {
      return await axios.post(`${process.env.INDEX_URI}/indexAffaire`, { source: source, decision: decision });
    } catch (e) {
      logger.error(e);
      return false;
    }
  }
}

exports.Indexing = new Indexing();
