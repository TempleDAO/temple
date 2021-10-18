require('dotenv').config();

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ganache";  // for testing
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";

import "./tasks/query";
// import "./tasks/management";

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
  solidity: "0.8.4",
          settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          },
        },
  typechain: {
    target: "ethers-v5",
  },
  networks: {
    rinkeby: {
      url: "https://eth-rinkeby.alchemyapi.io/v2/QqeiqrSzcuz0ZEcK3i01eL5gPmFgQRfu",
      accounts: [process.env.TESTNET_ADDRESS_PRIVATE_KEY],
    },
    mainnet: {
      url: "https://eth-mainnet.alchemyapi.io/v2/wMu8LWhZqh3KFpNCQZH4EVgNuF7qcrw9",
      accounts: (process.env.MAINNET_ADDRESS_PRIVATE_KEY) ? [process.env.MAINNET_ADDRESS_PRIVATE_KEY] : [],
      gasPrice: 100000000000,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};

