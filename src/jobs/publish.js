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
    console.log('---');
    for (let k in results[i]) {
      if ((/^pm/i.test(k) || /^am/i.test(k)) && results[i][k]) {
        console.log(k, results[i][k]);
      }
    }

    const results2 = await Database.find(
      'si.jurinet',
      `SELECT *
        FROM TITREREFERENCE
        WHERE ID_DOCUMENT = :id
        AND NUM_ANALYSE = :analyse
        ORDER BY NUM_TITREREFERENCE ASC`,
      [id, results[i].NUM_ANALYSE],
    );
    for (let i2 = 0; i2 < results2.length; i2++) {
      console.log('--->');
      for (let k2 in results2[i2]) {
        if ((/^pm/i.test(k2) || /^am/i.test(k2)) && results2[i2][k2]) {
          console.log('--->', k2, results2[i2][k2]);
        }
      }
    }
  }
}

main();
