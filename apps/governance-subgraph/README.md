# TempleDAO Governance Subgraph

### Subgraph Build and Deploy

1) Run `yarn install` to install the needed libraries.
2) Run `yarn graph auth --product hosted-service <access token>`. Replace `<access token>` with the token you can find on the [subgraphs dashboard](https://thegraph.com/hosted-service/dashboard/).
3) Run `yarn prepare:mainnet` to prepare the subgraph manifest.
4) Run `yarn codegen` to build the GraphQL schema.
5) Run `yarn build` to compile the AssemblyScript code.
6) Run `yarn deploy` to deploy the subgraph.
