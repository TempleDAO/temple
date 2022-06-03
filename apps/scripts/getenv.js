require('dotenv').config();
const Vercel = require('./lib/vercel');
const PROJECT_ID = process.env.PROJECT_ID;
const TEAM_ID = process.env.TEAM_ID;

go().catch((err) => {
  console.log('Oops...');
  console.log(err);
});

async function go() {
  const environment = process.argv[2];
  if (!['production', 'preview'].includes(environment)) {
    throw new Error('You must pass "preview" or "production" parameters');
  }
  const v = new Vercel(process.env.TOKEN);

  const list = await v.get(
    `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&decrypt=true`
  );

  const vars = list.envs
    .filter((entry) => entry.target.includes(environment))
    .sort(function (a, b) {
      if (a.key < b.key) {
        return -1;
      }
      if (a.key > b.key) {
        return 1;
      }
      return 0;
    });

  for (let i = 0; i < vars.length - 1; i++) {
    const entry = vars[i];
    const name = entry.key;
    const decrypted = await v.get(
      `/v9/projects/${PROJECT_ID}/env/${entry.id}?teamId=${TEAM_ID}&decrypt=true`
    );
    const value = decrypted.value;
    console.log(`${name}=${value}`);
  }
}
