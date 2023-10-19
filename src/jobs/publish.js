const { Database } = require('../modules/database');
const path = require('path');
const { Logger } = require('../modules/logger');
const logger = Logger.child({
  moduleName: require('path').basename(__filename, '.js'),
});

// !!!
const he = require('he');

async function main() {
  const id = 1791514;

  const titlesAndSummaries = [];

  const results = await Database.find(
    'si.jurinet',
    `SELECT *
    FROM ANALYSE
    WHERE ID_DOCUMENT = :id
    ORDER BY NUM_ANALYSE ASC`,
    [id],
  );
  for (let i = 0; i < results.length; i++) {
    const item = {
      titles: [],
      summary: null,
    };
    for (let k in results[i]) {
      if ((/^pm/i.test(k) || /^am/i.test(k)) && results[i][k]) {
        let text = results[i][k];
        try {
          text = he.decode(text);
        } catch (ignore) {}
        text = text.replace(/\*+\s*$/gm, '');
        text = text.replace(/\s+/gm, ' ');
        text = text.replace(/(\w)\s+\./gm, '$1.');
        text = text.replace(/\(\s+(\w)/gm, '($1');
        text = text.replace(/(\w)\s+\)/gm, '$1)');
        text = text.replace(/(\w)\(/gm, '$1 (');
        text = text.replace(/([^,]),(\w)/gm, '$1, $2');
        text = text.trim();
        if (text) {
          item.titles.push(text);
        }
      }
      if (/^som/i.test(k) && results[i][k]) {
        let text = results[i][k];
        try {
          text = he.decode(text);
        } catch (ignore) {}
        text = text.replace(/\*+\s*$/gm, '');
        text = text.replace(/\s+/gm, ' ');
        text = text.replace(/(\w)\s+\./gm, '$1.');
        text = text.replace(/\(\s+(\w)/gm, '($1');
        text = text.replace(/(\w)\s+\)/gm, '$1)');
        text = text.replace(/(\w)\(/gm, '$1 (');
        text = text.replace(/([^,]),(\w)/gm, '$1, $2');
        text - text.trim();
        if (text) {
          item.summary = text;
        }
      }
    }
    if (item.titles.length > 0 || item.summary !== null) {
      titlesAndSummaries.push(item);
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
      const item = {
        titles: [],
        summary: null,
      };
      for (let k2 in results2[i2]) {
        if ((/^pm/i.test(k2) || /^am/i.test(k2)) && results2[i2][k2]) {
          let text = results2[i2][k2];
          try {
            text = he.decode(text);
          } catch (ignore) {}
          text = text.replace(/\*+\s*$/gm, '');
          text = text.replace(/\s+/gm, ' ');
          text = text.replace(/(\w)\s+\./gm, '$1.');
          text = text.replace(/\(\s+(\w)/gm, '($1');
          text = text.replace(/(\w)\s+\)/gm, '$1)');
          text = text.replace(/(\w)\(/gm, '$1 (');
          text = text.replace(/([^,]),(\w)/gm, '$1, $2');
          text = text.trim();
          if (text) {
            item.titles.push(text);
          }
        }
        if (/^som/i.test(k2) && results2[i2][k2]) {
          let text = results2[i2][k2];
          try {
            text = he.decode(text);
          } catch (ignore) {}
          text = text.replace(/\*+\s*$/gm, '');
          text = text.replace(/\s+/gm, ' ');
          text = text.replace(/(\w)\s+\./gm, '$1.');
          text = text.replace(/\(\s+(\w)/gm, '($1');
          text = text.replace(/(\w)\s+\)/gm, '$1)');
          text = text.replace(/(\w)\(/gm, '$1 (');
          text = text.replace(/([^,]),(\w)/gm, '$1, $2');
          text - text.trim();
          if (text) {
            item.summary = text;
          }
        }
      }
      if (item.titles.length > 0 || item.summary !== null) {
        titlesAndSummaries.push(item);
      }
    }
  }

  console.log(JSON.stringify(titlesAndSummaries));
}

main();
