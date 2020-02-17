const { App } = require('adapt-authoring-core');
const exec = require('child_process').exec;
const fs = require('fs-extra');

const app = App.instance;

let artilleryBin;
let outputDir;
let rootDir;

async function benchmark() {
  console.log('Waiting for App to start...');
  await app.onReady();

  rootDir = app.getConfig('root_dir');
  artilleryBin = `${rootDir}/node_modules/artillery/bin/artillery`;
  outputDir = `${app.getConfig('temp_dir')}/artillery/${Date.now()}`;
  process.env.aat_url = app.config.get('adapt-authoring-server.url');
  // run tests
  runArtillery();
}

async function runArtillery() {
  console.log('Running benchmark tests (this may take a while...)');
  await fs.ensureDir(outputDir);
  const results = await Promise.allSettled(Object.values(app.dependencies).map(runTest));
  results.forEach(r => console.log(`[${r.status}] ${r.result || r.reason.message}`));
}

async function runTest(mod) {
  const configPath = `${rootDir}/artillery.yml`;
  const scriptPath = `${mod.rootDir}/artillery.yml`;
  const outputPath = `${outputDir}/${mod.name}.json`;
  const cmd = `${artilleryBin} run --config ${configPath} --output ${outputPath} -q ${scriptPath}`;

  try {
    await fs.stat(scriptPath);
  } catch(e) {
    if(e.code === 'ENOENT') {
      throw new Error(`${mod.name} doesn't define any artillery tests`);
    }
    throw e;
  }
  throw new Error(`Test failed for ${mod.name}`);
  return new Promise((resolve, reject) => {
    exec(cmd, async (error, stdout, stderr) => {
      if(error) {
        console.log('error:', error);
        return;
      }
      if(stderr) {
        console.log('stderr:', stderr);
        return;
      }
      await this.logOutput();
      resolve();
    });
  });
}

module.exports = benchmark;
