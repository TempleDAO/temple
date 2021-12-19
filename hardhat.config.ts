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
      // whitelisted to a single deployment address.
      url: "https://eth-rinkeby.alchemyapi.io/v2/QqeiqrSzcuz0ZEcK3i01eL5gPmFgQRfu",
      accounts: (process.env.RINKEBY_ADDRESS_PRIVATE_KEY) ? [process.env.RINKEBY_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 20000000000,
    },
    mainnet: {
      // whitelisted to a single deployment address.
      url: "https://eth-mainnet.alchemyapi.io/v2/YDQ_EDc7dwxDWf_U8LOgCXRFgKiQOa3K",
      accounts: (process.env.MAINNET_ADDRESS_PRIVATE_KEY) ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 55000000000,
    },
    matic: {
      url: "https://rpc-mainnet.maticvigil.com",
      accounts: (process.env.MAINNET_ADDRESS_PRIVATE_KEY) ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 40000000000,
    },
    hardhat: {
      chainId: 1337
    }
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

