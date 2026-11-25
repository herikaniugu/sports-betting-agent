const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { collectSnapshot } = require('./api/_scrape');

const dataPath = path.join(__dirname, 'data.js');

function readMatches() {
  const source = fs.readFileSync(dataPath, 'utf8');
  const context = vm.createContext({ window: {} });
  vm.runInContext(source + '\n;globalThis.__matches = typeof MATCHES !== "undefined" ? MATCHES : (window.MATCHES || []);', context);
  return Array.isArray(context.__matches) ? context.__matches : [];
}

async function updateData() {
  const snapshot = await collectSnapshot(readMatches());
  const { matches, updatedAt } = snapshot;
  const tempPath = dataPath + '.tmp';
  fs.writeFileSync(tempPath, 'window.SNAPSHOT_UPDATED_AT = ' + JSON.stringify(updatedAt) + ';\nwindow.MATCHES = ' + JSON.stringify(matches, null, 2) + ';\n');
  fs.renameSync(tempPath, dataPath);
  return Object.assign({}, snapshot, { total: matches.length });
}

if (require.main === module) {
  updateData()
    .then(result => {
      console.log('Snapshot updated at ' + result.updatedAt);
      console.log('Today ' + result.scraped + ' · Live ' + result.live + ' · Total ' + result.total);
    })
    .catch(error => {
      console.error('Snapshot update failed: ' + error.message);
      process.exit(1);
    });
}

module.exports = { updateData, collectSnapshot, readMatches, dataPath };
