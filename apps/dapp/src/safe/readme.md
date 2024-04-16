# Safe SDK v1.3.0 & Open API

## sdk folder

SDK source code facilitates the interaction with the [Safe contracts](https://github.com/safe-global/safe-contracts).

Majority of the src in this folder was copied from [SafeCore SDK release 33](https://github.com/safe-global/safe-core-sdk/releases/tag/r33). We had to copy it, instead of using the latest [npm package](@safe-global/protocol-kit) for the following reasons:

- Latest npm version `2.0.0` only allows ethers v6, and current dApp uses ethers v5. In the future when temple dApp migrates to v6, this is the recommended option to migrate to, but meanwhile we need to stick to the [preview version 1.3.0](https://www.npmjs.com/package/@safe-global/protocol-kit/v/1.3.0) which supports ethers v5.
- We tried to use the protocol-kit npm version 1.3.0 as package dependency, but when building the project for production, the app crashes with the following issue:

```
protocol-kit.js

Uncaught ReferenceError: Cannot access 'jt' before initialization
    at protocol-kit.6526b566.js:1:1206
```

- SafeCoreSDK@ProtocolKit src is still needed for sign and execute safe gnosis wallet transactions given the logic of their smart contracts.

_This is a minimal copy with only the required functions to execute safe contracts v1.3.0 signatures & executions_

### Source of files copied

sdk/contracts:

- [config.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/contracts/config.ts)
- [contractInstancesEthers.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/adapters/ethers/contracts/contractInstancesEthers.ts)
- [safeDeploymentContracts.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/contracts/safeDeploymentContracts.ts)

sdk/signatures:

- [SafeSignature.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/utils/signatures/SafeSignature.ts)
- [utils.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/utils/signatures/utils.ts)

sdk/transactions:

- [gas.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/utils/transactions/gas.ts)
- [SafeTransaction.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/utils/transactions/SafeTransaction.ts)

sdk/utils:

- [safeVersions.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/utils/safeVersions.ts)
- [types.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/types/index.ts)
- we've copied various util functions from various files, but main logic/src was copied from [utils.ts](https://github.com/safe-global/safe-core-sdk/blob/r33/packages/protocol-kit/src/Safe.ts)

## open-api folder

We didn't copy [SafeCoreSDK@api-kit](https://www.npmjs.com/package/@safe-global/api-kit) src, instead we've used the open api specification from https://safe-transaction-mainnet.safe.global/ and automatically generated the client code to interact with safe rest apis. This gives both more control over the apis we want to use, and also reduces complexity, one less third party dependency to worry.
