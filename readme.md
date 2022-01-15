# Temple Monorepo

## Local Dependencies

### Naming Convention
Please prefix all package names (in package.json) with `@temple/`. 
Ex: `@temple/dapp`, `@temple/protocols`

### Adding to projects
If you need to add a *local* dependency to another local project, for example a shared lib to the dapp, you *must* include the version. This is a [bug](https://github.com/yarnpkg/yarn/issues/4878) in yarn:

`yarn workspace @temple/dapp add @temple/demo@v1.0.0`


## Vercel

The integration with Vercel has changed. Because this is a monorepo, we have one parent folder with multiple subfolders as the apps that need to be deployed. Further complicating matters is that some apps that use typescript need to reference the parent folder since the tsconfig files source the parent one. To address this and other issues, this is how the vercel integration is setup:

  - We are no longer integrating with Github through Vercel. If you open a project in Vercel, it should say "Connect Github".. implying it's NOT connected. This is what we want.
  
  **We do NOT want Vercel to automatically build/deploy through their integration. We are doing this now through GitHub Actions!**  

  - For each mono repo application that needs to be deployed, there is one corresponding Vercel Project.

  - Each Vercel project *must* specify a Root Directory in settings that points to the monorepo folder. For ex, for the DApp, the Root Directory value is `apps/dapp`

  - we deploy to Vercel using the Vercel CLI, through GitHub actions

  Deploying through GitHub Actions gives us the power to control what deploys when, based on branch/pr, make it easy to generate prod, staging and per PR urls (for ex, each PR can get a deployment like `https://pr-{number}.stage.templedao.link`)


  ### How To Add New Project

  Note, as a pre-requisite, it's assumed the following secrets exist in the github repo: `VERCEL_TOKEN`, `VERCEL_ORG_ID`

  1. Create a new Vercel project. Sadly, Vercel is very pushy and wants to you to link the project to a github repo, which we don't want to do, so we have to go through these weird steps. 
  
  2. On your machine, make sure you have vercel cli installed, you're logged in with cli, and have enough permissions in Vercel account.

  3. run just `vercel`. This should start the project creation wizard. Accept most of the defaults. Set scope to temple. Set project name.

  4. Cancel when it starts deploying.

  5. Go to Dashboard > project > settings > general and note the Project ID

  6. Go to Github > TempleDAO/temple > settings > secrets, and add a new repository secret. Name: `[NAME]_PROJECT_ID` Value: projectid

  7. Setup a GitHub action to deploy. Go into the .github/workflows folde. Copy an existing workflow, and edit the `vercel-project-id` entry to use the new GitHub secret env name you created (`[NAME]_PROJECT_ID`)

  8. Tweak the workflow as needed; what branch/pr triggers, what aliases/urls to use, etc... 