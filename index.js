const { App } = require('adapt-authoring-core');
const exec = require('child_process').exec;

const app = App.instance;

async function benchmark() {
  await app.onReady();
  console.log('Running benchmark tests');
  runArtillery('courses', { method: 'get', count: 1000 });
}

async function runArtillery(endpoint, options = { count: 10 }) {
  const artilleryBin = `node_modules/artillery/bin/artillery`;
  const cmd = `${artilleryBin} run --count ${options.count} ${getUrl(endpoint)}`;
  console.log(cmd);
  // exec();
}

function getUrl(endpoint) {
  const g = app.config.getConfig;
  return `${g('adapt-authoring-server.root_url')}/api/${endpoint}`;
}

module.exports = benchmark();
