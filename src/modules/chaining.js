const { Database } = require('./database');
const { Logger } = require('./logger');
const logger = Logger.child({
  moduleName: require('path').basename(__filename, '.js'),
});
class Chaining {
  constructor() {}

  async getDecAttFromDB(id) {
    try {
      const results = [];
      const decAttInfo = await this.getDecAttInfo(id);

      for (let i = 0; i < decAttInfo.length; i++) {
        if (!decAttInfo[i] || !decAttInfo[i].NUM_RG || !decAttInfo[i].DT_DECATT) {
          throw new Error(`Chaining.getDecAttFromDB: empty or invalid chaining info for CC decision '${id}.`);
        }

        let decAttDate = new Date(Date.parse(decAttInfo[i].DT_DECATT));
        decAttDate.setHours(decAttDate.getHours() + 2);
        let strDecattDate = decAttDate.getFullYear();
        strDecattDate +=
          '-' + (decAttDate.getMonth() + 1 < 10 ? '0' + (decAttDate.getMonth() + 1) : decAttDate.getMonth() + 1);
        strDecattDate += '-' + (decAttDate.getDate() < 10 ? '0' + decAttDate.getDate() : decAttDate.getDate());

        let RGTerms = ['', ''];
        try {
          RGTerms = `${decAttInfo[i].NUM_RG}`.split('/');
          RGTerms[0] = RGTerms[0].replace(/\D/gm, '').replace(/^0+/gm, '').trim();
          RGTerms[1] = RGTerms[1].replace(/\D/gm, '').replace(/^0+/gm, '').trim();
        } catch (ignore) {}

        const decAttResult = await Database.find(
          'si.jurica',
          `SELECT *
          FROM JCA_DECISION
          WHERE REGEXP_LIKE(JCA_DECISION.JDEC_NUM_RG, '^0*${RGTerms[0]}/0*${RGTerms[1]} *$')
          AND JCA_DECISION.JDEC_DATE = '${strDecattDate}'`,
          [],
        );

        if (decAttResult && decAttResult.length > 0) {
          for (let j = 0; j < decAttResult.length; j++) {
            results.push(decAttResult[j].JDEC_ID);
          }
        } else {
          throw new Error(`Chaining.getDecAttFromDB: contested CA decision related to CC decision '${id} not found.`);
        }

        return results.filter((value, index, self) => {
          return self.indexOf(value) === index;
        });
      }
    } catch (e) {
      // logger.warn(e);
      return null;
    }
  }

  async getDecAttInfo(id) {
    /* From Richard ANGER (03/03/2021):
    1. DOCUMENT.ID_DOCUMENT = ID de la décision
    Ex : 1727146
    2. Table DOCUM.NUMPOURVOI
    ID_DOCUMENT   LIB = N° pourvoi complet  NUMPOURVOICODE = N° pourvoi sans clé
    1727146       U1826378                  1826378
    3. Table GPCIV.AFF
    CODE      ID_AFFAIRE = identifiant du pourvoi
    1826378   11110412
    4. Table GPCIV.DECATT
    ID_AFFAIRE  NUM_RG = N° RG de la décision attaquée
    11110412    16/02749
    */
    if (!id) {
      throw new Error(`Chaining.getDecAttInfo: invalid ID '${id}'.`);
    }

    // 1. Get the decision from Jurinet:
    const decision = await Database.findOne(
      'si.jurinet',
      `SELECT *
      FROM DOCUMENT
      WHERE DOCUMENT.ID_DOCUMENT = :id`,
      [id],
    );
    if (decision) {
      // 2. Get the pourvoi related to the decision:
      const pourvoi = await Database.findOne(
        'si.jurinet',
        `SELECT *
        FROM NUMPOURVOI
        WHERE NUMPOURVOI.ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (pourvoi) {
        // 3. Get the affaire related to the pourvoi:
        const affaire = await Database.findOne(
          'si.jurinet',
          `SELECT *
          FROM GPCIV.AFF
          WHERE GPCIV.AFF.CODE = :code`,
          [pourvoi.NUMPOURVOICODE],
        );
        if (affaire) {
          // 4. Get the contested decision(s) related to the affaire:
          const decAtts = await Database.find(
            'si.jurinet',
            `SELECT *
            FROM GPCIV.DECATT
            WHERE GPCIV.DECATT.ID_AFFAIRE = :id`,
            [affaire.ID_AFFAIRE],
          );
          if (decAtts && decAtts.length > 0) {
            for (let i = 0; i < decAtts.length; i++) {
              decAtts[i]['ID_DOCUMENT'] = id;
              decAtts[i]['ID_ELMSTR'] = affaire.ID_ELMSTR;
            }
            return decAtts;
          } else {
            throw new Error(`Chaining.getDecAttInfo: contested decision not found for CC decision '${id}'.`);
          }
        } else {
          throw new Error(`Chaining.getDecAttInfo: affaire not found for CC decision '${id}'.`);
        }
      } else {
        throw new Error(`Chaining.getDecAttInfo: pourvoi not found for CC decision '${id}'.`);
      }
    } else {
      throw new Error(`Chaining.getDecAttInfo: CC decision '${id}' not found.`);
    }
  }
}

exports.Chaining = new Chaining();
