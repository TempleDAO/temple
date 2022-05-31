# TempleDAO Core Subgraph

## Local Development Steps

### Graph node setup

1) If a local hardhat node is not already running, go to the `protocol` directory and run `yarn local-node` to start.
1) In a new terminal window, run `yarn graph:setup`. This will pull the graph-node project and build the docker image.
1) Run `yarn graph:start` to start the local subgraph node. It may take a few minutes to fully start.
1) Use `yarn graph:stop` to stop the node.

### Subgraph Build and Deploy

1) Open a new terminal window, separate from the other two above.
1) Run `yarn install` to install the needed libraries.
1) Run `yarn codegen` to build the GraphQL schema.
1) Run `yarn build` to compile the AssemblyScript code.
1) Run `yarn create-local` to create the subgraph.
1) Run `yarn deploy-local` to deploy the subgraph.
