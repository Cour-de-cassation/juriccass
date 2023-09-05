const { Database, ObjectId } = require('./database');

class Collector {
  constructor() {}

  // const test = await Database.findOne('sder.rawJurinet', { _id: 1899265 });

  async collectNewDecisionsFromDB(count, startDate) {
    const batch = [];

    let oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);
    let formattedOneMonthAgo = oneMonthAgo.getDate() < 10 ? '0' + oneMonthAgo.getDate() : oneMonthAgo.getDate();
    formattedOneMonthAgo +=
      '/' + (oneMonthAgo.getMonth() + 1 < 10 ? '0' + (oneMonthAgo.getMonth() + 1) : oneMonthAgo.getMonth() + 1);
    formattedOneMonthAgo += '/' + oneMonthAgo.getFullYear();

    const docs = await Database.find(
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

  async collectNewDecisionsFromAPI(count, startDate) {
    const batch = [];
    // @TODO
    return batch;
  }
}

exports.Collector = new Collector();
