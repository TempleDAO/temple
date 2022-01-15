import hre from "hardhat";
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";

import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { ExitQueue__factory } from "../typechain/factories/ExitQueue__factory";
import { BigNumber, providers } from "ethers";
import { TempleStaking__factory } from "../typechain/factories/TempleStaking__factory";
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import { TempleTreasury__factory } from "../typechain/factories/TempleTreasury__factory";
import { MintAndStake__factory } from "../typechain/factories/MintAndStake__factory";
import { Block, getLineAndCharacterOfPosition } from "typescript";

function toCents(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function main() {
  const [owner] = await ethers.getSigners();

  const envVar = (name: string): string => {
    if (process.env[name] === undefined) {
      throw new Error(`missing env variable: ${name}`)
    }

    return process.env[name] || '';
  }

  const DAI = new ERC20__factory(owner).attach(envVar('DAI_ADDRESS'))
  const TEMPLE = new TempleERC20Token__factory(owner).attach(envVar('TEMPLE_ADDRESS'))
  const EXIT_QUEUE = new ExitQueue__factory(owner).attach(envVar('EXIT_QUEUE_ADDRESS'))
  const STAKING = new TempleStaking__factory(owner).attach(envVar('TEMPLE_STAKING_ADDRESS'))
  const TREASURY = new TempleTreasury__factory(owner).attach(envVar('TREASURY_ADDRESS'))
  const MINT_AND_STAKE = new MintAndStake__factory(owner).attach(envVar('MINT_AND_STAKE_ADDRESS'))

  const fromBlock = 0;
  const toBlock = 100;

  // TREASURY MintComplete
  (await TREASURY.queryFilter(TREASURY.filters.MintComplete(), fromBlock, toBlock))
  .forEach(async v => {
    const b = await ethers.provider.getBlock(v.blockNumber);
    const {minter, daiAccepted, templeMinted} = v.args

    const logMetric = (name: string, value: any) => {
      console.log(b.number, b.timestamp, `Treasury.MintComplete.${name}`, value)
    }
    logMetric("minter", minter);
    logMetric("daiAccepted", daiAccepted.toString());
    logMetric("templeMinted", templeMinted.toString());
  });

  // MINT_AND_STAKE MINT MintComplete
  (await MINT_AND_STAKE.queryFilter(MINT_AND_STAKE.filters.MintComplete(), fromBlock, toBlock))
  .forEach(async v => {
    const b = await ethers.provider.getBlock(v.blockNumber);
    const {minter, daiAccepted, templeMinted} = v.args

    const logMetric = (name: string, value: any) => {
      console.log(b.number, b.timestamp, `MintAndStake.MintComplete.${name}`, value)
    }
    logMetric("minter", minter);
    logMetric("daiAccepted", daiAccepted.toString());
    logMetric("templeMinted", templeMinted.toString());
  });

  // EXIT_QUEUE JoinQueue
  (await EXIT_QUEUE.queryFilter(EXIT_QUEUE.filters.JoinQueue(), fromBlock, toBlock))
  .forEach(async v => {
    const b = await ethers.provider.getBlock(v.blockNumber);
    const {exiter, amount} = v.args

    const logMetric = (name: string, value: any) => {
      console.log(b.number, b.timestamp, `ExitQueue.JoinQueue.${name}`, value)
    }
    logMetric("exiter", exiter);
    logMetric("amount", amount.toString());

    // XXX: We need the total that can leave unstake queue as well, I think we do this by
    //       1. adding start epoch/end epoch/start block/end block to Join metric
    //       2. Quering as at blockNumber for what these values are and writing them out
    //          NOTE: if same user exits with small number multiple times, we loose this info
    // 
    // Other option is to add another event we emit each time we allocate to a specific epoch
    // (futureBlock, amount) - which we can capture and log as a future block number.
  });

  // EXIT_QUEUE Withdrawal
  (await EXIT_QUEUE.queryFilter(EXIT_QUEUE.filters.Withdrawal(), fromBlock, toBlock))
  .forEach(async v => {
    const b = await ethers.provider.getBlock(v.blockNumber);
    const {exiter, amount} = v.args

    const logMetric = (name: string, value: any) => {
      console.log(b.number, b.timestamp, `ExitQueue.Withdrawal.${name}`, value)
    }
    logMetric("exiter", exiter);
    logMetric("amount", amount.toString());
  });

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
