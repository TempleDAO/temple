require('dotenv').config();

import {task} from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ganache'; // for testing
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-contract-sizer';

// NOTE: Any tasks that depend on the generated typechain makes the build flaky.
//       Favour scripts instead
if (process.env.NODE_ENV === 'test')
  console.log('Running HardHat in TEST mode');
if (!process.env.ETHERSCAN_API_KEY) {
  console.log(
    "NOTE: environment variable ETHERSCAN_API_KEY isn't set. tasks that interact with etherscan won't work"
  );
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
//

import { subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names';

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths = await runSuper();

    return paths.filter((p: string) => {
      return !p.endsWith('.t.sol');
    });
  }
);

/*task('verify-contract', `Verify a task's deployment on a block explorer`)
  .addParam('id', 'Deployment task ID')
  .addParam('name', 'Contract name')
  .addParam('address', 'Contract address')
  .addParam('args', 'ABI-encoded constructor arguments')
  .addOptionalParam('key', 'Etherscan API key to verify contracts')
  .setAction(
    async (
      args: { id: string; name: string; address: string; key: string; args: string; verbose?: boolean },
      hre: HardhatRuntimeEnvironment
    ) => {
      Logger.setDefaults(false, args.verbose || false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiKey = args.key ?? (hre.config.networks[hre.network.name] as any).verificationAPIKey;
      const verifier = apiKey ? new Verifier(hre.network, apiKey) : undefined;

      // Contracts can only be verified in Live mode
      await new Task(args.id, TaskMode.LIVE, hre.network.name, verifier).verify(args.name, args.address, args.args);
    }
  );*/

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
      {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
    ],
  },
  typechain: {
    target: 'ethers-v5',
    outDir: './typechain',
  },
  networks: {
    hardhat: {
      //    allowUnlimitedContractSize: true,
      chainId: 31337,
      mining:
        process.env.NODE_ENV === 'test'
          ? {
              auto: true,
              interval: 0,
            }
          : {
              auto: true,
              interval: 5000,
            },
    },
    rinkeby: {
      url: process.env.RINKEBY_RPC_URL || '',
      accounts: process.env.RINKEBY_ADDRESS_PRIVATE_KEY
        ? [process.env.RINKEBY_ADDRESS_PRIVATE_KEY]
        : [],
      gasPrice: 8000000000,
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || '',
      accounts: process.env.GOERLI_ADDRESS_PRIVATE_KEY 
        ? [process.env.GOERLI_ADDRESS_PRIVATE_KEY]
        : [],
      gasPrice: 8000000000,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || '',
      accounts: process.env.MAINNET_ADDRESS_PRIVATE_KEY
        ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY]
        : [],
      gasPrice: parseInt(process.env.MAINNET_GAS_IN_GWEI || '0') * 1000000000,
    },
    matic: {
      url: process.env.MATIC_RPC_URL || '',
      accounts: process.env.MATIC_ADDRESS_PRIVATE_KEY
        ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY]
        : [],
      gasPrice: 40000000000,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 120000,
  },
  contractSizer: {
    alphaSort: true,
  },
};
