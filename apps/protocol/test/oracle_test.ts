import { ethers, network } from "hardhat";
import { expect } from "chai";

import {
 TemplePriceOracle,
 TemplePriceOracle__factory,
} from "../typechain";

import { BigNumber, Contract, Signer } from "ethers";
import { toAtto, shouldThrow, blockTimestamp, fromAtto } from "./helpers";

const fmtPricePair = (pair: [BigNumber, BigNumber, number?]): [number, number] => {
  return [fromAtto(pair[0]), fromAtto(pair[1])]
}
const fmtTemplePrice = (pair: [BigNumber, BigNumber, number?]): number => {
  return fromAtto(pair[1])/fromAtto(pair[0]);
}

const masterOracleABI = [{"inputs":[{"internalType":"address","name":"_admin","type":"address"},{"internalType":"bool","name":"_canAdminOverwrite","type":"bool"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"}],"name":"NewAdmin","type":"event"},{"inputs":[],"name":"BTC_ETH_PRICE_FEED","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ETH_USD_PRICE_FEED","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"canAdminOverwrite","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newAdmin","type":"address"}],"name":"changeAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"feedBaseCurrencies","outputs":[{"internalType":"enum ChainlinkPriceOracleV2.FeedBaseCurrency","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract CToken","name":"cToken","type":"address"}],"name":"getUnderlyingPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"underlying","type":"address"}],"name":"price","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"priceFeeds","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"underlyings","type":"address[]"},{"internalType":"contract AggregatorV3Interface[]","name":"feeds","type":"address[]"},{"internalType":"enum ChainlinkPriceOracleV2.FeedBaseCurrency","name":"baseCurrency","type":"uint8"}],"name":"setPriceFeeds","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const masterOraclerAddress = "0xb0602af43Ca042550ca9DA3c33bA3aC375d20Df4";

describe("price", async () => {
    let oracle: TemplePriceOracle;
    let masterOracle: Contract;
    let owner: Signer
    
    beforeEach(async () => {

      await network.provider.request({
        method: "hardhat_reset",
        params: [
            {
            forking: {
                jsonRpcUrl: process.env.MAINNET_RPC_URL,
                blockNumber: Number(process.env.FORK_BLOCK_NUMBER),
            },
            },
        ],
        });

        oracle = await new TemplePriceOracle__factory(owner).deploy();
        masterOracle = await new Contract(masterOraclerAddress, masterOracleABI)
    })
})