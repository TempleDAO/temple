require('dotenv').config();
const fs = require('fs');
const pressAnyKey = require('press-any-key');

const Vercel = require('./lib/vercel');
const SHADOW_PROJECT_ID = process.env.SHADOW_PROJECT_ID;
const TEAM_ID = process.env.TEAM_ID;

go().catch((err) => {
  console.log('Oops...');
  console.log(err);
});

async function go() {
  const environment = process.argv[2];
  const projectId = process.argv[3];
  const file = process.argv[4];
  if (!['production', 'preview'].includes(environment)) {
    throw new Error('You must pass "preview" or "production" parameters');
  }
  if (!projectId) {
    throw new Error('You must pass projectId as the second parameter');
  }
  if (!file) {
    throw new Error('You must pass env file as the third parameter');
  }
  const v = new Vercel(process.env.TOKEN);
  const project = await v.get(`/v9/projects/${projectId}?teamId=${TEAM_ID}`);

  console.log(`Please confirm:`);
  console.log(`Environment: ${environment}`);
  console.log(`Vercel Project ID: ${projectId} (${project.name})`);
  console.log(`File: ${file}`);

  await pressAnyKey();

  for await (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const [key, value] = line.split('=');
    const data = {
      key,
      value,
      type: 'encrypted',
      target: [environment],
    };
    const result = await v.setEnv(data, TEAM_ID, SHADOW_PROJECT_ID);
    console.log(result);
  }
}
