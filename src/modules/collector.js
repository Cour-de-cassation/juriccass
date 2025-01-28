const { Database } = require('./database');
const { DateTime } = require('luxon');
const { Chaining } = require('./chaining');
const { Indexing } = require('./indexing');
const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');
const logger = Logger.child({
  moduleName: require('path').basename(__filename, '.js'),
});

class Collector {
  constructor() {}

  async collectNewDecisions() {
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
      decisions[i] = await this.completeDecision(decisions[i]);
    }

    return await this.filterCollectedDecision(decisions);
  }

  async getUpdatedDecisions(lastDate) {
    const date = lastDate.toJSDate();
    let strDate = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    strDate += '/' + (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1);
    strDate += '/' + date.getFullYear();

    const decisions = await Database.find(
      'si.jurinet',
      `SELECT *
      FROM DOCUMENT
      WHERE DOCUMENT.XML IS NOT NULL
      AND DOCUMENT.DT_MODIF > TO_DATE('${strDate}', 'DD/MM/YYYY')
      ORDER BY DOCUMENT.ID_DOCUMENT ASC`,
    );

    for (let i = 0; i < decisions.length; i++) {
      decisions[i] = await this.completeDecision(decisions[i]);
    }

    return await this.filterCollectedDecisions(decisions, true);
  }

  async completeDecision(decision) {
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
    decision._decatt = await Chaining.getDecAtt(decision.ID_DOCUMENT);

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

  async filterCollectedDecisions(decisions, updated) {
    let whitelist = [];

    try {
      whitelist = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', '..', 'settings', 'id_collect_whitelist.json')).toString(),
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
        if (updated === true) {
          const found = await Database.findOne('sder.rawJurinet', { _id: decision.ID_DOCUMENT });
          if (found === null) {
            filtered.collected.push({
              decision: decision,
              diff: null,
            });
          } else {
            const updatable = [
              'XML',
              'TYPE_ARRET',
              'JURIDICTION',
              'ID_CHAMBRE',
              'NUM_DECISION',
              'DT_DECISION',
              'ID_SOLUTION',
              'TEXTE_VISE',
              'RAPROCHEMENT',
              'SOURCE',
              'DOCTRINE',
              'IND_ANO',
              'AUT_ANO',
              'DT_ANO',
              'DT_MODIF',
              'DT_MODIF_ANO',
              'DT_ENVOI_DILA',
              '_titrage',
              '_analyse',
              '_partie',
              '_decatt',
              '_portalis',
              '_bloc_occultation',
              'IND_PM',
              'IND_ADRESSE',
              'IND_DT_NAISSANCE',
              'IND_DT_DECE',
              'IND_DT_MARIAGE',
              'IND_IMMATRICULATION',
              'IND_CADASTRE',
              'IND_CHAINE',
              'IND_COORDONNEE_ELECTRONIQUE',
              'IND_PRENOM_PROFESSIONEL',
              'IND_NOM_PROFESSIONEL',
              'IND_BULLETIN',
              'IND_RAPPORT',
              'IND_LETTRE',
              'IND_COMMUNIQUE',
              'ID_FORMATION',
              'OCCULTATION_SUPPLEMENTAIRE',
              '_natureAffaireCivil',
              '_natureAffairePenal',
              '_codeMatiereCivil',
              '_nao_code',
            ];
            const shouldNotBeUpdated = ['XML'];
            const triggerReprocess = [
              'IND_PM',
              'IND_ADRESSE',
              'IND_DT_NAISSANCE',
              'IND_DT_DECE',
              'IND_DT_MARIAGE',
              'IND_IMMATRICULATION',
              'IND_CADASTRE',
              'IND_CHAINE',
              'IND_COORDONNEE_ELECTRONIQUE',
              'IND_PRENOM_PROFESSIONEL',
              'IND_NOM_PROFESSIONEL',
              'OCCULTATION_SUPPLEMENTAIRE',
              '_bloc_occultation',
              '_natureAffaireCivil',
              '_natureAffairePenal',
              '_codeMatiereCivil',
              '_nao_code',
            ];
            const sensitive = ['XML', '_partie', 'OCCULTATION_SUPPLEMENTAIRE'];
            let diff = null;
            let anomaly = false;
            let reprocess = false;
            updatable.forEach((key) => {
              if (JSON.stringify(decision[key]) !== JSON.stringify(found[key])) {
                if (diff === null) {
                  diff = {};
                }
                if (sensitive.indexOf(key) !== -1) {
                  diff[key] = {
                    old: '[SENSITIVE]',
                    new: '[SENSITIVE]',
                  };
                } else {
                  diff[key] = {
                    old: JSON.stringify(found[key]),
                    new: JSON.stringify(decision[key]),
                  };
                }
                if (shouldNotBeUpdated.indexOf(key) !== -1) {
                  anomaly = true;
                }
                if (triggerReprocess.indexOf(key) !== -1) {
                  reprocess = true;
                }
              }
            });
            if (diff === null) {
              filtered.rejected.push({
                decision: decision,
                reason: 'decision has no significant difference',
              });
            } else {
              filtered.collected.push({
                decision: decision,
                diff: diff,
                anomaly: anomaly,
                reprocess: reprocess,
              });
            }
          }
        } else {
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

  async storeAndNormalizeNewDecisions(decisions, updated) {
    for (let i = 0; i < decisions.length; i++) {
      let decision = decisions[i].decision;
      try {
        decision._indexed = null;
        if (updated === true) {
          if (decisions[i].diff === null) {
            await Database.insertOne('sder.rawJurinet', decision);
            await Indexing.indexDecision('cc', decision, null, 'import in rawJurinet (sync)');
          } else {
            if (decisions[i].reprocess === true) {
              decision.IND_ANO = 0;
              decision.XMLA = null;
              if (decisions[i].anomaly === true) {
                await Indexing.updateDecision(
                  'cc',
                  decision,
                  null,
                  `update in rawJurinet and reprocessed (sync) - original text could have been changed - changelog: ${JSON.stringify(
                    decisions[i].diff,
                  )}`,
                );
              } else {
                await Indexing.updateDecision(
                  'cc',
                  decision,
                  null,
                  `update in rawJurinet and reprocessed (sync) - changelog: ${JSON.stringify(decisions[i].diff)}`,
                );
              }
            } else if (decisions[i].anomaly === true) {
              await Indexing.updateDecision(
                'cc',
                decision,
                null,
                `update in rawJurinet (sync) - original text could have been changed - changelog: ${JSON.stringify(
                  decisions[i].diff,
                )}`,
              );
            } else {
              await Indexing.updateDecision(
                'cc',
                decision,
                null,
                `update in rawJurinet (sync) - changelog: ${JSON.stringify(decisions[i].diff)}`,
              );
            }
            await Database.replaceOne('sder.rawJurinet', { _id: decision._id }, decision);
          }
          await Indexing.indexAffaire('cc', decision);

          let normalized = await Database.findOne('sder.decisions', { sourceId: decision._id, sourceName: 'jurinet' });
          if (normalized === null) {
            let normDec = (await Indexing.normalizeDecision('cc', decision, null, false, true)).result;
            const insertResult = await Database.insertOne('sder.decisions', normDec);
            normDec._id = insertResult.insertedId;
            await Indexing.indexDecision('sder', normDec, null, 'import in decisions (sync)');
          } else if (normalized.locked === false && decisions[i].diff !== null) {
            let normDec = (await Indexing.normalizeDecision('cc', decision, normalized, false, true)).result;
            normDec.dateCreation = new Date().toISOString();
            normDec.zoning = null;
            if (decisions[i].reprocess) {
              normDec.pseudoText = undefined;
              normDec.pseudoStatus = 0;
              normDec.labelStatus = 'toBeTreated';
              normDec.labelTreatments = [];
            }
            await Database.replaceOne('sder.decisions', { _id: normalized._id }, normDec);
            normDec._id = normalized._id;
            if (decisions[i].reprocess === true) {
              await Indexing.updateDecision(
                'sder',
                normDec,
                null,
                `update in decisions and reprocessed (sync) - changelog: ${JSON.stringify(decisions[i].diff)}`,
              );
            } else {
              await Indexing.updateDecision(
                'sder',
                normDec,
                null,
                `update in decisions (sync) - changelog: ${JSON.stringify(decisions[i].diff)}`,
              );
            }
          }
        } else {
          await Database.insertOne('sder.rawJurinet', decision);
          await Indexing.indexDecision('cc', decision, null, 'import in rawJurinet');
          await Indexing.indexAffaire('cc', decision);

          let normalized = await Database.findOne('sder.decisions', { sourceId: decision._id, sourceName: 'jurinet' });
          if (normalized === null) {
            let normDec = (await Indexing.normalizeDecision('cc', decision, null, false, true)).result;
            const insertResult = await Database.insertOne('sder.decisions', normDec);
            normDec._id = insertResult.insertedId;
            await Indexing.indexDecision('sder', normDec, null, 'import in decisions');
            await Database.writeQuery(
              'si.jurinet',
              `UPDATE DOCUMENT
                SET IND_ANO = :pending
                WHERE ID_DOCUMENT = :id`,
              [1, decision._id],
            );
          } else {
            logger.warn(
              `Jurinet import anomaly: decision ${decision._id} seems new but a related SDER record ${normalized._id} already exists.`,
            );
            await Indexing.updateDecision('sder', normalized, null, `SDER record ${normalized._id} already exists`);
          }
        }
      } catch (e) {
        await Indexing.updateDecision('cc', decision, null, null, e);
        await Database.writeQuery(
          'si.jurinet',
          `UPDATE DOCUMENT
            SET IND_ANO = :erroneous
            WHERE ID_DOCUMENT = :id`,
          [4, decision._id],
        );
        if (updated) {
          logger.error(
            `storeAndNormalizeDecisions error for decision ${decision._id} (sync) - changelog: ${JSON.stringify(
              decisions[i].diff,
            )}`,
            e,
          );
        } else {
          logger.error(`storeAndNormalizeDecisions error for decision ${decision._id} (collect)`, e);
        }
      }
    }
    return true;
  }
}

exports.Collector = new Collector();
