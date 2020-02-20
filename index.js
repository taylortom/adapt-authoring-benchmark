const { App } = require('adapt-authoring-core');
const chalk = require('chalk');
const exec = require('child_process').exec;
const fs = require('fs-extra');
const path = require('path');

const Errors = {
  ENOTESTS: 'ENOTESTS'
};

const app = App.instance;

let artilleryBin;
let tempDir;
let outputDir;
let rootDir;

async function benchmark() {
  console.log('Running benchmark tests.\n\nWaiting for App to start...\n');
  await app.onReady();

  rootDir = app.getConfig('root_dir');
  artilleryBin = `${rootDir}/node_modules/artillery/bin/artillery`;
  tempDir = `${app.getConfig('temp_dir')}/artillery`;
  process.env.aat_url = app.config.get('adapt-authoring-server.url');
  // run tests
  await runTests();
  process.exit();
}

async function runTests() {
  await fs.remove(tempDir);
  await fs.ensureDir(tempDir);
  console.log('Running tests');
  const results = await Promise.allSettled(Object.values(app.dependencies).map(runTest));
  results.sort(sortByStatus).forEach(logResult);
}

async function runTest(mod) {
  const configPath = `${rootDir}/artillery.yml`;
  const scriptPath = `${mod.rootDir}/artillery.yml`;
  const outputPath = `${tempDir}/${mod.name}.json`;
  const cmd = `${artilleryBin} run --config ${configPath} --output ${outputPath} -q ${scriptPath}`;
  try {
    await fs.stat(scriptPath);
  } catch(e) {
    if(e.code === 'ENOENT') {
      throw createError(`Module doesn't define any artillery tests`, mod, Errors.ENOTESTS);
    }
    throw e;
  }
  return new Promise((resolve, reject) => {
    exec(cmd, async (error, stdout, stderr) => {
      if(error) {
        reject(error);
        return;
      }
      if(stderr) {
        reject(stderr);
        return;
      }
      resolve({ module: mod.name, ...(await fs.readJson(outputPath)) });
    });
  });
}

function createError(message, mod, code) {
  const e = new Error(message);
  e.module = mod.name;
  e.code = code;
  return e;
}

function logResult(result) {
  if(result.status === 'rejected') {
    if(result.reason.code !== Errors.ENOTESTS) {
      console.log(`[${result.reason.module}] ${result.reason.message}`);
    }
    return;
  }
  const d = result.value.aggregate;
  console.log(`\n${result.value.module}`);
  logSep();
  console.log(`${label('Scenarios completed')}: ${val(d.scenariosCompleted)}/${val(d.scenariosCreated)} (total reqs: ${val(d.requestsCompleted)})`);
  console.log(`${label('Status codes')}: ${Object.entries(d.codes).map(([code,count]) => `${code}: ${val(count)}`).join(', ')}`);
  console.log(`${label('Latency')}: average: ${val(`${d.latency.median}ms`)}, min: ${val(`${d.latency.min}ms`)}, max: ${val(`${d.latency.max}ms`)}, 95%: ${val(`${d.latency.p95}ms`)}`);
  console.log(`${label('Average requests per second')}: ${val(`${d.rps.mean}`)}`);
  logSep();
}

function label(l) {
  return chalk.underline(l);
}
function val(v) {
  return chalk.yellow(v);
}

function logSep(s = '-') {
  console.log(s.repeat(80));
}

function sortByStatus(a, b) {
  if(a.status === 'rejected') return -1;
}

module.exports = benchmark;
