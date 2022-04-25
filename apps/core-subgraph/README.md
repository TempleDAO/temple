# TempleDAO Core Subgraph

Head over to the [wiki](https://github.com/TempleDAO/templedao-core-subgraph/wiki) to get started.

## Local Development Steps

### Graph node setup

1) Run `yarn local-ganache` in one window, and open a new window for the next steps.
1) Run `yarn local-graph-setup` in a new window.
1) Run `yarn local-graph-start` to start the local subgraph node. It may take a few minutes to fully start.

Note you can use `yarn local-graph-stop` to stop the node.

### Subgraph Build and Deploy

1) Open a new terminal window, separate from the other two above.
1) Run `yarn install` to install the needed libraries.
1) Run `yarn codegen` to build the GraphQL schema.
1) Run `yarn build` to compile the AssemblyScript code.
1) Run `yarn create-local` to create the subgraph.
1) Run `yarn deploy-local` to deploy the subgraph.
