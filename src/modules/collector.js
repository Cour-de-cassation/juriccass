const { Database } = require('./database');
const { DateTime } = require('luxon');
const { Chaining } = require('./chaining');
const { Indexing } = require('./indexing');
const fs = require('fs');
const path = require('path');

class Collector {
  constructor() {}

  async collectNewDecisionsUsingDB() {
    let oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);
    let formattedOneMonthAgo = oneMonthAgo.getDate() < 10 ? '0' + oneMonthAgo.getDate() : oneMonthAgo.getDate();
    formattedOneMonthAgo +=
      '/' + (oneMonthAgo.getMonth() + 1 < 10 ? '0' + (oneMonthAgo.getMonth() + 1) : oneMonthAgo.getMonth() + 1);
    formattedOneMonthAgo += '/' + oneMonthAgo.getFullYear();

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

    for (let i = 0; i < decisions.length; i++) {
      decisions[i] = await this.completeDecisionUsingDB(decisions[i]);
    }

    return await this.filterCollectedDecisionsUsingDB(decisions);
  }

  async completeDecisionUsingDB(decision) {
    decision._portalis = null;

    // Inject "titrage" data (if any) into the document:
    try {
      const titrage = await Database.find(
        'si.jurinet',
        `SELECT *
        FROM TITREREFERENCE
        WHERE ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (titrage && titrage.length > 0) {
        decision._titrage = titrage;
      } else {
        decision._titrage = null;
      }
    } catch (ignore) {
      decision._titrage = null;
    }

    // Inject "analyse" data (if any) into the document:
    try {
      const analyse = await Database.find(
        'si.jurinet',
        `SELECT *
        FROM ANALYSE
        WHERE ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (analyse && analyse.length > 0) {
        decision._analyse = analyse;
      } else {
        decision._analyse = null;
      }
    } catch (ignore) {
      decision._analyse = null;
    }

    // Inject "partie" data (if any) into the document:
    try {
      const partie = await Database.find(
        'si.jurinet',
        `SELECT *
        FROM VIEW_PARTIE
        WHERE ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (partie && partie.length > 0) {
        decision._partie = partie;
      } else {
        decision._partie = null;
      }
    } catch (ignore) {
      decision._partie = null;
    }

    // Inject "decatt" data (if any) into the document:
    decision._decatt = await Chaining.getDecAttUsingDB(decision.ID_DOCUMENT);

    // Inject "bloc_occultation" data (if any) into the document:
    try {
      const pourvoi = await Database.findOne(
        'si.jurinet',
        `SELECT *
        FROM NUMPOURVOI
        WHERE NUMPOURVOI.ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (pourvoi && pourvoi.NUMPOURVOICODE) {
        const affaire = await Database.findOne(
          'si.jurinet',
          `SELECT *
          FROM GPCIV.AFF
          WHERE GPCIV.AFF.CODE = :code`,
          [pourvoi.NUMPOURVOICODE],
        );
        if (affaire) {
          const matiere = await Database.findOne(
            'si.jurinet',
            `SELECT *
            FROM GPCIV.MATIERE
            WHERE GPCIV.MATIERE.ID_MATIERE = :id`,
            [affaire.ID_MATIERE],
          );
          if (matiere) {
            decision._bloc_occultation = matiere.ID_BLOC;
          } else {
            decision._bloc_occultation = null;
          }
        } else {
          decision._bloc_occultation = null;
        }
      } else {
        decision._bloc_occultation = null;
      }
    } catch (ignore) {
      decision._bloc_occultation = null;
    }

    // Inject "nature affaire" data (if any) into the document:
    try {
      decision._codeMatiereCivil = null;
      decision._natureAffaireCivil = null;
      decision._codeMatierePenal = null;
      decision._natureAffairePenal = null;
      const pourvoi = await Database.findOne(
        'si.jurinet',
        `SELECT *
        FROM NUMPOURVOI
        WHERE NUMPOURVOI.ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (pourvoi && pourvoi.NUMPOURVOICODE) {
        const civilMatiere = await Database.findOne(
          'si.jurinet',
          `SELECT *
          FROM GPCIV.AFF
          WHERE GPCIV.AFF.CODE = :code`,
          [pourvoi.NUMPOURVOICODE],
        );
        if (civilMatiere && civilMatiere.ID_MATIERE) {
          decision._codeMatiereCivil = civilMatiere.ID_MATIERE;
          const civilNature = await Database.findOne(
            'si.jurinet',
            `SELECT *
            FROM GRCIV.MATIERE
            WHERE GRCIV.MATIERE.ID_MATIERE = :code`,
            [civilMatiere.ID_MATIERE],
          );
          if (civilNature && civilNature.ID_NATAFF) {
            decision._natureAffaireCivil = civilNature.ID_NATAFF;
          }
        }
        const penalMatiere = await Database.findOne(
          'si.jurinet',
          `SELECT *
          FROM GPPEN.AFF
          WHERE GPPEN.AFF.CODE = :code`,
          [pourvoi.NUMPOURVOICODE],
        );
        if (penalMatiere && penalMatiere.ID_NATAFF) {
          decision._codeMatierePenal = penalMatiere.ID_NATAFF;
          const penalNature = await Database.findOne(
            'si.penal',
            `SELECT *
            FROM GRPEN.NATAFF
            WHERE GRPEN.NATAFF.ID_NATAFF = :code`,
            [penalMatiere.ID_NATAFF],
          );
          if (penalNature && penalNature.ID_NATAFF) {
            decision._natureAffairePenal = penalNature.ID_NATAFF;
          }
        }
      }
    } catch (ignore) {}

    // Inject "nao" code (if any) into the document:
    try {
      decision._nao_code = null;
      const pourvoi = await Database.findOne(
        'si.jurinet',
        `SELECT *
        FROM NUMPOURVOI
        WHERE NUMPOURVOI.ID_DOCUMENT = :id`,
        [decision.ID_DOCUMENT],
      );
      if (pourvoi && pourvoi.NUMPOURVOICODE) {
        const affaire = await Database.findOne(
          'si.jurinet',
          `SELECT *
          FROM GPCIV.AFF
          WHERE GPCIV.AFF.CODE = :code`,
          [pourvoi.NUMPOURVOICODE],
        );
        if (affaire && affaire.ID_NAO && /null/i.test(`${affaire.ID_NAO}`) === false) {
          decision._nao_code = affaire.ID_NAO;
          const nao = await Database.findOne(
            'si.jurinet',
            `SELECT *
            FROM GPCIV.NAO
            WHERE GPCIV.NAO.ID_NAO = :code`,
            [affaire.ID_NAO],
          );
          if (nao && nao.ID_BLOC) {
            decision._bloc_occultation = nao.ID_BLOC;
          }
        }
      }
    } catch (ignore) {}

    return decision;
  }

  async filterCollectedDecisionsUsingDB(decisions) {
    let whitelist = [];

    try {
      whitelist = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', '..', 'settings', 'id_whitelist.json')).toString(),
      );
    } catch (ignore) {}

    const filtered = {
      collected: [],
      rejected: [],
    };

    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];

      if (
        whitelist.indexOf(decision.ID_DOCUMENT) !== -1 ||
        decision.TYPE_ARRET === 'CC' ||
        (decision.TYPE_ARRET === 'AUTRE' &&
          (/^t\.cfl$/i.test(decision.ID_CHAMBRE) === true || /judiciaire.*paris$/i.test(decision.JURIDICTION)))
      ) {
        try {
          let inDate = new Date(Date.parse(decision.DT_DECISION.toISOString()));
          inDate.setHours(inDate.getHours() + 2);
          inDate = DateTime.fromJSDate(inDate);
          if (whitelist.indexOf(decision.ID_DOCUMENT) === -1 && inDate.diffNow('months').toObject().months <= -6) {
            filtered.rejected.push({
              decision: decision,
              reason: 'decision is too old',
            });
          } else if (whitelist.indexOf(decision.ID_DOCUMENT) === -1 && inDate.diffNow('days').toObject().days > 1) {
            filtered.rejected.push({
              decision: decision,
              reason: 'decision is too early',
            });
          } else {
            const found = await Database.findOne('sder.rawJurinet', { _id: decision.ID_DOCUMENT });
            if (whitelist.indexOf(decision.ID_DOCUMENT) !== -1 || found === null) {
              filtered.collected.push({
                decision: decision,
              });
            } else {
              filtered.rejected.push({
                decision: decision,
                reason: 'decision already collected',
              });
            }
          }
        } catch (e) {
          filtered.rejected.push({
            decision: decision,
            reason: e.message,
          });
        }
      } else {
        filtered.rejected.push({
          decision: decision,
          reason: 'wrong type of decision or wrong jurisdiction',
        });
      }
    }
    return filtered;
  }

  async storeAndNormalizeDecisionsUsingDB(decisions) {
    for (let i = 0; i < decisions.length; i++) {
      let decision = decisions[i];
      decision._indexed = null;

      await Database.insertOne('sder.rawJurinet', decision, { bypassDocumentValidation: true });

      await Indexing.indexDecision('cc', decision, null, 'import in rawJurinet');

      await Indexing.indexAffaire('cc', decision);
    }
    return true;
  }

  // @TODO
  async collectNewDecisionsUsingAPI() {
    const decisions = {
      collected: [],
      rejected: [],
    };
    return decisions;
  }

  // @TODO
  async storeAndNormalizeDecisionsUsingAPI(decisions) {
    return true;
  }
}

exports.Collector = new Collector();
