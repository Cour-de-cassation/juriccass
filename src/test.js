const { Database, ObjectId } = require('./modules/database');
const axios = require('axios');
const http = require('http');
const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
const router = express.Router();
router.post(`/normalizeDecision`, async (req, res) => {
  console.log(req.body.decision);
  const jobId = `${ObjectId()}`;
  const jobType = 'normalizeDecision';
  let result = false;
  let error = null;
  /*
  switch (`${req.body.source}`.toLowerCase()) {
    case 'cc':
      try {
        result = await CC.Normalize(req.body.decision, req.body.previousDecision, req.body.ignorePreviousContent);
        if (req.body.cleanContent) {
          result.originalText = CC.removeMultipleSpace(result.originalText);
          result.originalText = CC.replaceErroneousChars(result.originalText);
          result.pseudoText = CC.removeMultipleSpace(result.pseudoText);
          result.pseudoText = CC.replaceErroneousChars(result.pseudoText);
        }
      } catch (e) {
        error = e;
      }
      break;
    case 'ca':
      try {
        result = await CA.Normalize(req.body.decision, req.body.previousDecision, req.body.ignorePreviousContent);
        if (req.body.cleanContent) {
          result.originalText = CA.removeMultipleSpace(result.originalText);
          result.originalText = CA.replaceErroneousChars(result.originalText);
          result.pseudoText = CA.removeMultipleSpace(result.pseudoText);
          result.pseudoText = CA.replaceErroneousChars(result.pseudoText);
        }
      } catch (e) {
        error = e;
      }
      break;
    case 'tj':
      try {
        result = await TJ.Normalize(req.body.decision, req.body.previousDecision, req.body.ignorePreviousContent);
      } catch (e) {
        error = e;
      }
      break;
  }
  */
  res.status(200).json({
    jobId: jobId,
    jobType: jobType,
    result: result,
    error: error,
  });

  return true;
});
app.use(router);
const server = http.createServer(app);
server.listen(6666, () => {
  console.info(`Start HTTP server on port 6666.`);
  setTimeout(test, 1000);
});

async function test() {
  try {
    const decision = {
      _id: new ObjectId(),
      foo: 'bar',
    };
    const result = await axios.post(`http://127.0.0.1:6666/normalizeDecision`, { source: 'cc', decision: decision });
    console.log(result);
  } catch (e) {
    console.error(e);
    return false;
  }
}
