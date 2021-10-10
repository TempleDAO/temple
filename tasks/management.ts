import '@nomiclabs/hardhat-ethers';
import { task } from "hardhat/config";
import { BaseContract, BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import {
  ExitQueue__factory,
  FakeERC20__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  TempleTreasury__factory
} from '../typechain';
import { Network } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Presale__factory } from '../typechain/factories/Presale__factory';

function toNumber(n: string) {
  const num = Number(n);
  if (num === NaN) {
    throw new Error("Not a number - check args");
  }

  return num;
}

function toAtto(numOrString: number|string) {
  let n = numOrString
  if (typeof(n) === typeof('')) {
    n = toNumber(numOrString.toString());
  }
  
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

const verifyCmd = (network: Network, address: string, ...args: string[]) => {
  console.log(`yarn hardhat verify --network ${network.name} ${address} ${args.join(' ')}`);
}

const CONTRACT_ADDRESS: {[key: string]: {
  DAI_ADDRESS: string,
  TEMPLE_ADDRESS: string,
  TEMPLE_STAKING_ADDRESS: string,
  TREASURY_ADDRESS: string,
  EXIT_QUEUE_ADDRESS: string,
  PRESALE: string,
}} = {
  rinkeby: {
    DAI_ADDRESS: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C', 
    TEMPLE_ADDRESS: '0x3278b75A8C63b6B6A27F05551d6ECc16D0827269',
    EXIT_QUEUE_ADDRESS: '0xF8826A44BA52B95cf38487751377BA821EC6d545',
    TEMPLE_STAKING_ADDRESS: '0x9628fD70Ef1C21F02135a76037FC72E8959aE157',
    TREASURY_ADDRESS: '0xBc0ddA6D4fcff8540A023522a7b101f566bF7E34',
    PRESALE: '0x8053f8C6Ec9B7EA38c6235044a68a8Af4598Db04',
  }
}

const contracts = (signer: SignerWithAddress, network: Network) => {
  return {
    DAI: new FakeERC20__factory(signer).attach(CONTRACT_ADDRESS[network.name].DAI_ADDRESS),
    TEMPLE: new TempleERC20Token__factory(signer).attach(CONTRACT_ADDRESS[network.name].TEMPLE_ADDRESS),
    STAKING: new TempleStaking__factory(signer).attach(CONTRACT_ADDRESS[network.name].TEMPLE_STAKING_ADDRESS),
    TREASURY: new TempleTreasury__factory(signer).attach(CONTRACT_ADDRESS[network.name].TREASURY_ADDRESS),
    EXIT_QUEUE: new ExitQueue__factory(signer).attach(CONTRACT_ADDRESS[network.name].EXIT_QUEUE_ADDRESS),
    PRESALE: new Presale__factory(signer).attach(CONTRACT_ADDRESS[network.name].PRESALE),
  }
}


async function mine(tx: Promise<ContractTransaction>) {
  await (await tx).wait()
}

async function mineDeploy<T extends BaseContract>(contract: Promise<T>) {
  await (await contract).deployed();
  return contract;
}

task("mint-test-dai", "Mint Fake DAI into the given test account")
  .addParam("address", "the address to mint DAI into")
  .setAction(async (args: {address: string}, hre) => {

  // const signer = await hre.ethers.getSigner(args.address);
  const [owner] = await hre.ethers.getSigners();

  await mine(contracts(owner, hre.network).DAI.mint(args.address, toAtto(100000)));
})

task("seed-mint", "Seed mint to bootstrap treasury")
  .setAction(async (args, hre) => {

  // const signer = await hre.ethers.getSigner(args.address);
  const [owner] = await hre.ethers.getSigners();

  const {DAI,TREASURY} = contracts(owner, hre.network);

  await mine(DAI.increaseAllowance(TREASURY.address, toAtto(100)));
  await mine(TREASURY.seedMint(toAtto(100), toAtto(1000)));
})

task("add-pool", "Add a pool to treasury")
  .addParam("address", "the address of the pool to add")
  .addParam("harvestShare", "share of harvest")
  .setAction(async (args: {address: string, dai: string, temple: string, harvestShare: string}, hre) => {

  const [owner] = await hre.ethers.getSigners();

  const {TREASURY} = contracts(owner, hre.network);
  await mine(TREASURY.setPoolHarvestShare(args.address, toNumber(args.harvestShare)));
})

task("increase-presale-allocation", "increase a users campaign allocation")
  .addParam("address", "address to increase")
  .addParam("increaseBy", "amount to increase by (task will scale this up by 1e18)")
  .setAction(async (args: {address: string, increaseBy: string}, hre) => {

  const [owner] = await hre.ethers.getSigners();
  const {PRESALE} = contracts(owner, hre.network);
  await mine(PRESALE.increaseAddressAllocation(args.address, toAtto(args.increaseBy)))
})

task("set-presale-epoch", "set a users presale epoch")
  .addParam("address", "address to increase")
  .addParam("epoch", "epoch in which user can access their presale allocation")
  .setAction(async (args: {address: string, epoch: string}, hre) => {

  const [owner] = await hre.ethers.getSigners();
  const {PRESALE} = contracts(owner, hre.network);
  await mine(PRESALE.setAddressAllocationEpoch(args.address, toNumber(args.epoch)));
})
