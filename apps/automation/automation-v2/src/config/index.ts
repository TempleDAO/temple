import { ContractAddresses} from "./contract_addresses/types";
import { CONTRACTS as TESTNET_CONTRACTS } from "./contract_addresses/anvil";
import { CONTRACTS as SEPOLIA_CONTRACTS } from "./contract_addresses/sepolia";
import { CONTRACTS as MAINNET_CONTRACTS } from "./contract_addresses/mainnet";
import { TxSubmissionParams } from "@mountainpath9/overlord-viem";
import { Chain, parseEther } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { TaskContext } from "@mountainpath9/overlord-core";
import * as vars from "./variables";
import { BigRational } from "@mountainpath9/big-rational";


export interface Config {
  chainId: number,

  contracts: ContractAddresses,

  stableGoldAuctionSignerId: string,

  stakingSignerId: string,
}

const TESTNET_CONFIG: Config = {
    chainId: 42161, // arb one fork
    stableGoldAuctionSignerId: 'tgld_daigold_auction_signer',
    stakingSignerId: 'tgld_staking_signer',
    contracts: TESTNET_CONTRACTS,
};

const SEPOLIA_CONFIG: Config = {
  chainId: 11155111,
  stableGoldAuctionSignerId: 'tgld_daigold_auction_signer',
  stakingSignerId: 'tgld_staking_signer',
  contracts: SEPOLIA_CONTRACTS,
}

const MAINNET_CONFIG: Config = {
  chainId: 1,
  stableGoldAuctionSignerId: 'tgld_daigold_auction_signer',
  stakingSignerId: 'tgld_staking_signer',
  contracts: MAINNET_CONTRACTS,
}

async function getMainnetSubmissionParams(ctx: TaskContext): Promise<TxSubmissionParams> {
  const t0MaxPriorityFeePerGas =
    await vars.mainnet_t0_max_priority_fee_per_gas.requireValue(ctx);

  const t1MaxPriorityFeePerGas =
    await vars.mainnet_t1_max_priority_fee_per_gas.getValue(ctx);

  const t2MaxPriorityFeePerGas =
    await vars.mainnet_t2_max_priority_fee_per_gas.getValue(ctx);

  return {
    // our initial gas tip
    t0MaxPriorityFeePerGas: t0MaxPriorityFeePerGas.toScaledBigInt(1n),
    
    // Wait for 30 secs before increasing tip
    t1Secs: 30,
    t1MaxPriorityFeePerGas: t1MaxPriorityFeePerGas?.toScaledBigInt(1n),

    // Wait for another two minutes minute before cancelling
    t2Secs: 150,
    t2MaxPriorityFeePerGas: t2MaxPriorityFeePerGas?.toScaledBigInt(1n),

    // Wait for another minute before giving up on cancellation
    t3Secs: 210
  }
}

async function getSepoliaSubmissionParams(ctx: TaskContext): Promise<TxSubmissionParams> {
  const t0MaxPriorityFeePerGas =
    await vars.sepolia_t0_max_priority_fee_per_gas.requireValue(ctx);

  const t1MaxPriorityFeePerGas =
    await vars.sepolia_t1_max_priority_fee_per_gas.getValue(ctx);

  const t2MaxPriorityFeePerGas =
    await vars.sepolia_t2_max_priority_fee_per_gas.getValue(ctx);

  return {
    // our initial gas tip
    t0MaxPriorityFeePerGas: t0MaxPriorityFeePerGas.toScaledBigInt(1n),
    
    // Wait for 30 secs before increasing tip
    t1Secs: 30,
    t1MaxPriorityFeePerGas: t1MaxPriorityFeePerGas?.toScaledBigInt(1n),

    // Wait for another two minutes minute before cancelling
    t2Secs: 150,
    t2MaxPriorityFeePerGas: t2MaxPriorityFeePerGas?.toScaledBigInt(1n),

    // Wait for another minute before giving up on cancellation
    t3Secs: 210
  }
}

export async function getSubmissionParams(ctx: TaskContext, chainId: number): Promise<TxSubmissionParams> {
  if (chainId === mainnet.id) {
    return getMainnetSubmissionParams(ctx);
  } else if (chainId === sepolia.id) {
    return getSepoliaSubmissionParams(ctx);
  } else {
    throw Error(`Invalid chain ${chainId}`);
  }
}

export function getConfig(env: string): Config {
    switch(env) {
      case 'testnet': return TESTNET_CONFIG;
      case 'sepolia':
        return SEPOLIA_CONFIG;
      case 'mainnet':
        return MAINNET_CONFIG;
    }
    throw new Error(`Unknown config env: ${env}`);
}

export function chainFromId(id: number): Chain {
  if (id === mainnet.id) {
    return mainnet;
  } else if (id === sepolia.id) {
    return sepolia;
  }
  else throw new Error("unsupported chain");
}

export function getMinBalanceForChain(chainId: number): BigRational {
  if (chainId === mainnet.id) {
    return BigRational.fromDecimalString("0.1");
  } else if (chainId === sepolia.id) {
    return BigRational.fromDecimalString("0.02");
  } else {
    throw Error(`Invalid chain ${chainId}`);
  }
}

export function getMaxGasPriceForChain(chainId: number): BigRational {
  // Returns max gas price in gwei. The result is compared to estimated maxFeePerGas in gwei units
  if (chainId === mainnet.id) {
    // 6 gwei
    return BigRational.fromNumber(6);
  } else if (chainId === sepolia.id) {
    // 6 gwei
    return BigRational.fromNumber(6);
  } else {
    throw Error(`Invalid chain ${chainId}`);
  }
}
  