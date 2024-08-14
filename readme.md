# Temple Monorepo

## Getting Started
### Requirements
* node 
* yarn
* Docker

This repository uses `.nvmrc` to dictate the version of node required to compile and run the project. This will allow you to use `nvm` followed by either `nvm use` or `nvm install` to automatically set the right version of node in that terminal session.

If developing on Windows, some scripts are currently written in bash so WSL is recommended to run those. For most developments tasks you'll likely only need to run the steps in Protocol local deployment and Dapp. 

This project uses yarn workspaces to share common dependencies between all the applications. Before attempting to run any of the apps, you'll want to run `yarn install` from the root of the project. 

### Quick Start 

**This script is still experimental so your mileage may vary**

At the root of the project, running `yarn run:stack` will attempt to:  
* compile the contracts
* run a local hardhat node 
* deploy the contracts to said node
* copy deployed contract addresses to dapps config file
* copy hardhat factories into the dapp 
* run the dapp in dev mode

The script groups the child processes so issuing a single `SIGINT` (ctrl+c) should stop all the processes. 

Requirements:  
* bash
* rsync
* sed
* grep

### Contracts (/Protocol)
#### Local Deployment
The protocol app uses hardhat for development. The following steps will compile the contracts and deploy to a local hardhat node

```
# Enter the correct dir
cd apps/protocol

# Compile the contracts
yarn compile

# In one terminal window, run a local-node
yarn local-node

# In another window, run the deploy script
yarn local-deploy
```

The protocol test suite can be run without deploying to a local-node by running

```
# Run tests, no deployment necessary
yarn test
```

#### Rinkeby Deployment
```
export RINKEBY_ADDRESS_PRIVATE_KEY=...  # export from metamask
export RINKEBY_RPC_URL=... 		# grab RPC url from metamask or create a relayer on alchemy

yarn hardhat:testnet run scripts/deploys/rinkeby/{your-script-name}
```

Once successfully deployed on testnet, verify contract source on etherscan. If you use the `deployAndMine` helper when creating your
script, it will spit out the relevant command. It will look something like this

```
yarn hardhat verify --network rinkeby 0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54 
```

It's fine to have multiple versions of a contract on rinkeby, so it's okay to run before your PR is merged (and re-run if there are any
comments on the PR on how to best setup the deploy scripts).

You can also run and test locally by replacing `yarn workspace @temple/protocol hardhat:testnet` with `yarn workspace @temple/protocol hardhat:local`. You'll probably have to run some of the previous deploys
in order to setup the right local state

### Dapp
The Dapp uses [Vite](https://vitejs.dev/) but we've created some convenience methods on top. In order to properly communicate with the contracts deployed on the local node we need to update your `.env.local` file. Make a copy of the `env.local.example` and rename it to `.env.local`. Once the steps in Protocol Local Deployment have been completed, the deploy job output all the deployed contract addresses deployed to your local network in the correct Vite env var format. Copy these values and paste them into your `.env.local` file. 

```
# Enter the correct dir
cd apps/dapp

# Run the dapp in dev mode
yarn dev

# Alternatively, you can compile the dapp and run in 'production' mode locally
yarn build

yarn serve
```

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

  Note, as a pre-requisite, it's assumed the following secrets exist in the github repo: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `GITHUB_TOKEN`

  1. Create a new Vercel project. Sadly, Vercel is very pushy and wants to you to link the project to a github repo, which we don't want to do, so we have to go through these weird steps. 
  
  2. On your machine, make sure you have vercel cli installed, you're logged in with cli, and have enough permissions in Vercel account.

  3. run just `vercel`. This should start the project creation wizard. Accept most of the defaults. Set scope to temple. Set project name.

  4. Cancel when it starts deploying.

  5. Go to Dashboard > project > settings > general and note the Project ID

  6. Go to Github > TempleDAO/temple > settings > secrets, and add a new repository secret. Name: `[NAME]_PROJECT_ID` Value: projectid

  7. Setup a GitHub action to deploy. Go into the .github/workflows folde. Copy an existing workflow, and edit the `vercel-project-id` entry to use the new GitHub secret env name you created (`[NAME]_PROJECT_ID`)

  8. Tweak the workflow as needed; what branch/pr triggers, what aliases/urls to use, etc... 


  ## Contributing

  We welcome all contributors to this project - please see the [contribution guide](https://github.com/TempleDAO/temple/blob/main/CONTRIBUTING.md) for more information on how to get involved and what to expect.