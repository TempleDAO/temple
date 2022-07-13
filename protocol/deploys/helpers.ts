import { network } from "hardhat";
import { BaseContract, BigNumber, ContractFactory, ContractTransaction } from "ethers";
import fs from 'fs';

/**
 * Wait for a transaction to mine
 */
export async function mine(tx: Promise<ContractTransaction>) {
  await (await tx).wait();
}

/**
 * Typesafe helper that works on contract factories to create, deploy, wait till deploy completes
 * and output useful commands to setup etherscan with contract code
 */
export async function deployAndMine<T extends BaseContract, D extends (...args: any[]) => Promise<T>>(
                name: string,
                factory: ContractFactory,
                deploy: D,
                ...args: Parameters<D>): Promise<T> {

  if (factory.deploy !== deploy) {
    throw new Error("Contract factory and deploy method don't match");
  }

  const verifyRenderedArgs: any[] = [];
  for (const arg of args) {
    if (arg instanceof Buffer) {
      verifyRenderedArgs.push(`0x${arg.toString('hex')}`)
    } else if (arg instanceof BigNumber) {
      verifyRenderedArgs.push(arg.toString())
    } else {
      // XXX(jeeva): As we deploy smart contracts, we'll realise which types we need to fix here
      verifyRenderedArgs.push(arg);
    }
  }

  console.log(`*******Deploying ${name} on ${network.name} with args ${JSON.stringify(verifyRenderedArgs, null, 2)}`);
  const contract = await factory.deploy(...args) as T;
  console.log(`Deployed... waiting for transaction to mine`);
  console.log();
  await contract.deployed();
  console.log('Contract deployed');
  console.log(`export ${name}=${contract.address}`);

  const deployArgsDir = `${__dirname}/${network.name}`;
  if (!fs.existsSync(deployArgsDir)) {
    fs.mkdirSync(deployArgsDir);
  }
  fs.writeFileSync(`${deployArgsDir}/${contract.address}.js`, `module.exports = ${JSON.stringify(verifyRenderedArgs, null, 2)}`)

  console.log(`hardhat verify args written to ${deployArgsDir}/${contract.address}.js`);
  console.log('********************\n');

  return contract;
}

const expectedEnvvars: {[key: string]: string[]} = {
  mainnet: ['MAINNET_ADDRESS_PRIVATE_KEY', 'MAINNET_RPC_URL', 'MAINNET_GAS_IN_GWEI'],
  testnet: ['TESTNET_ADDRESS_PRIVATE_KEY', 'TESTNET_RPC_URL'],
  localhost: [],
}

/**
 * Check if the required environment variables exist
 */
export function ensureExpectedEnvvars(args: {[key: string]: string}) {
  let hasAllExpectedEnvVars = true;
  for (const envvarName of expectedEnvvars[network.name].concat(Object.keys(args))) {
    if (!process.env[envvarName]) {
      console.error(`Missing environment variable ${envvarName}`);
      hasAllExpectedEnvVars = false;
    }

    args[envvarName] = process.env[envvarName] || '';
  }

  if (!hasAllExpectedEnvVars) {
    throw new Error(`Expected envvars missing`);
  }

  return args;
}
