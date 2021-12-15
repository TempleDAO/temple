require('dotenv').config();

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ganache";  // for testing
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";

// NOTE: Issue with tasks as they depend on typechain typescript which may not have been generated yet.
//       Favour scripts with helpers over tasks
// import "./tasks/on-chain-ops";

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
      },
      {
        version: "0.5.16",
      },
      {
        version: "0.6.6",
      },
    ],
  },
  typechain: {
    target: "ethers-v5",
  },
  networks: {
    rinkeby: {
      url: "https://eth-rinkeby.alchemyapi.io/v2/QqeiqrSzcuz0ZEcK3i01eL5gPmFgQRfu",
      accounts: (process.env.RINKEBY_ADDRESS_PRIVATE_KEY) ? [process.env.RINKEBY_ADDRESS_PRIVATE_KEY] : [],
    },
    mainnet: {
      url: "https://eth-mainnet.alchemyapi.io/v2/wMu8LWhZqh3KFpNCQZH4EVgNuF7qcrw9",
      accounts: (process.env.MAINNET_ADDRESS_PRIVATE_KEY) ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 100000000000,
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

