require('dotenv').config();

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ganache";  // for testing
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";

// NOTE: Any tasks that depend on the generated typechain makes the build flaky.
//       Favour scripts instead

if (!process.env.ETHERSCAN_API_KEY) {
  console.log("NOTE: environment variable ETHERSCAN_API_KEY isn't set. tasks that interact with etherscan won't work");
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
//

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
    ],
  },
  typechain: {
    target: "ethers-v5",
  },
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_RPC_URL || '',
      accounts: (process.env.RINKEBY_ADDRESS_PRIVATE_KEY) ? [process.env.RINKEBY_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 2000000000,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || '',
      accounts: (process.env.MAINNET_ADDRESS_PRIVATE_KEY) ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: parseInt(process.env.MAINNET_GAS_IN_GWEI || '0') * 1000000000,
    },
    matic: {
      url: process.env.MATIC_RPC_URL || '',
      accounts: (process.env.MATIC_ADDRESS_PRIVATE_KEY) ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 40000000000,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  mocha: {
    timeout: 120000
  }
};

