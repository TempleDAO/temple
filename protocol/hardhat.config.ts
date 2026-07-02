require('dotenv').config();

import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import { ANVIL_SIGNER_PRIVATE_KEYS } from './scripts/deploys/anvil';

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

function getGasPrice(envValue: string | undefined): number | undefined {
  if (!envValue) return undefined;
  return parseInt(envValue) * 1000000000;
}

function getNetworkConfig(network: string) {
  function getEnvVar(name: string): string | undefined {
      return process.env[name];
  }

  function getMaxGasInWei(envVar: string): number | undefined {
      const v = getEnvVar(envVar);
      return v ? parseInt(v) * 1000000000 : undefined;
  }

  // Use the env set private key, otherwise fallback to the first anvil signer.
  function getPrivateKey(envVar: string) {
      const pk = getEnvVar(envVar);
      return pk ? pk : ANVIL_SIGNER_PRIVATE_KEYS[0];
  }
  
  const networkUpper = network.toUpperCase();
  const pk = getPrivateKey(`${networkUpper}_ADDRESS_PRIVATE_KEY`);
  const rpc = getEnvVar(`${networkUpper}_RPC_URL`) || '';
  const gasPrice = getMaxGasInWei(`${networkUpper}_GAS_IN_GWEI`);
  
  return {
      url: rpc,
      accounts: [pk],
      gasPrice,
  };
}

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
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts-hardhat",
    cache: "./cache-hardhat", // Use a different cache for Hardhat than Foundry
  },
  solidity: {
    compilers: [
      {
        version: '0.8.28',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },  
        },
      },
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },  
        },
      },
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
    localhost: {
        timeout: 100_000,
    },
    anvil: {
        url: "http://127.0.0.1:8545/",
        accounts: "remote",
    },
    arbitrum: getNetworkConfig('arbitrum'),
    mainnet: getNetworkConfig('mainnet'),
    sepolia: getNetworkConfig('sepolia'),
    arbitrumSepolia: getNetworkConfig('arbitrumSepolia'),
    berachain: {
        chainId: 80094,
        ...getNetworkConfig('berachain'),
    },
    bepolia: {
        chainId: 80069,
        ...getNetworkConfig('bepolia'),
    },
    goerli: getNetworkConfig('goerli'),
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "berachain",
        chainId: 80094,
        urls: {
            // For Routescan if required (API key is unused, so can be anything)
            // apiURL:
            // "https://api.routescan.io/v2/network/mainnet/evm/80094/etherscan",
            // browserURL: "https://80094.routescan.io/",

            // For Berascan
            apiURL:
                "https://api.berascan.com/api",
            browserURL: "https://berascan.com//",
        },
      },
      {
        network: "bepolia",
        chainId: 80069,
        urls: {
            apiURL:
                "https://api.routescan.io/v2/network/testnet/evm/80069/etherscan",
            browserURL: "https://bepolia.beratrail.io/",
        },
      },
    ]
  },
  mocha: {
    timeout: 300000,
  },
  contractSizer: {
    alphaSort: true,
  },
};
