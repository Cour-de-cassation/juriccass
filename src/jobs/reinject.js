require('../modules/env');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  jobName: require('path').basename(__filename, '.js'),
});
const { Collector } = require('../modules/collector');

async function main() {
  logger.info('Start');
  let decisions;

  if (process.env.USE_SI_API === 'ON') {
    logger.info('Reinject using SI API');
    // ???
  } else {
    logger.info('Reinject using direct DB access');

    // XXX

    const decisions = await Database.find(
      'si.jurinet',
      `SELECT *
      FROM DOCUMENT
      WHERE DOCUMENT.XML IS NOT NULL
      AND DOCUMENT.XMLA IS NULL
      AND DOCUMENT.IND_ANO = 0
      AND DOCUMENT.DT_CREATION >= TO_DATE('${formattedOneMonthAgo}', 'DD/MM/YYYY')
      ORDER BY DOCUMENT.ID_DOCUMENT ASC`,
    );
  }

  if (decisions && decisions.collected && Array.isArray(decisions.collected) && decisions.collected.length > 0) {
    logger.info(`${decisions.collected.length} decision(s) collected`);

    if (process.env.USE_DBSDER_API === 'ON') {
      logger.info('Store and normalize using DBSDER API');
      await Collector.storeAndNormalizeNewDecisionsUsingDB(decisions.collected);
    } else {
      logger.info('Store and normalize using direct DB access');
      await Collector.storeAndNormalizeNewDecisionsUsingDB(decisions.collected);
    }
  } else {
    logger.info('No decision collected');
  }

  logger.info('End');
  process.exit(0);
}

main();

async function reinjectJurinet() {
  const client = new MongoClient(process.env.MONGO_URI, {
    useUnifiedTopology: true,
  });
  await client.connect();
  const database = client.db(process.env.MONGO_DBNAME);
  const rawJurinet = database.collection(process.env.MONGO_JURINET_COLLECTION);
  const decisions = database.collection(process.env.MONGO_DECISIONS_COLLECTION);

  const jurinetSource = new JurinetOracle();
  await jurinetSource.connect();

  console.log('Retrieve all "done" decisions for Jurinet...');
  let decision,
    successCount = 0,
    errorCount = 0;
  const cursor = await decisions
    .find({ labelStatus: 'done', sourceName: 'jurinet' }, { allowDiskUse: true })
    .sort({ sourceId: -1 });
  while ((decision = await cursor.next())) {
    try {
      if (decision && decision[process.env.MONGO_ID]) {
        console.log(`reinject decision ${decision.sourceId}...`);
        await jurinetSource.reinject(decision);
        const reinjected = await jurinetSource.getDecisionByID(decision.sourceId);
        reinjected._indexed = null;
        reinjected.DT_ANO = new Date();
        reinjected.DT_MODIF = new Date();
        reinjected.DT_MODIF_ANO = new Date();
        await rawJurinet.replaceOne({ _id: reinjected._id }, reinjected, { bypassDocumentValidation: true });
        // The labelStatus of the decision goes from 'done' to 'exported'.
        // We don't do this in the 'reinject' method because we may need
        // to reinject some decisions independently of the Label workflow:
        decision.labelStatus = 'exported';
        decision.dateCreation = new Date().toISOString();
        await decisions.replaceOne({ _id: decision[process.env.MONGO_ID] }, decision, {
          bypassDocumentValidation: true,
        });
        await JudilibreIndex.updateDecisionDocument(decision, null, 'reinject');
        successCount++;
      }
    } catch (e) {
      console.error(`Jurinet reinjection error processing decision ${decision._id}`, e);
      await JudilibreIndex.updateDecisionDocument(decision, null, null, e);
      errorCount++;
    }
  }
  console.log(`Jurinet reinjection done (success: ${successCount}, errors: ${errorCount}).`);
  await cursor.close();
  await jurinetSource.close();
  await client.close();
  return true;
}
