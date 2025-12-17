import { ContractAddresses} from "./contract_addresses/types";
import { CONTRACTS as TESTNET_CONTRACTS } from "./contract_addresses/anvil";
import { CONTRACTS as SEPOLIA_CONTRACTS } from "./contract_addresses/sepolia";
import { CONTRACTS as MAINNET_CONTRACTS } from "./contract_addresses/mainnet";
import { TxSubmissionParams } from "@mountainpath9/overlord-viem";
import { Chain } from "viem";
import { mainnet, berachain, sepolia } from "viem/chains";
import { TaskContext } from "@mountainpath9/overlord-core";
import * as vars from "./variables";


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

async function getMainnetSepoliaSubmissionParams(ctx: TaskContext): Promise<TxSubmissionParams> {
  const t0MaxPriorityFeePerGas =
    await vars.mainnet_sepolia_t0_max_priority_fee_per_gas.requireValue(ctx);

  const t1MaxPriorityFeePerGas =
    await vars.mainnet_sepolia_t1_max_priority_fee_per_gas.getValue(ctx);

  const t2MaxPriorityFeePerGas =
    await vars.mainnet_sepolia_t2_max_priority_fee_per_gas.getValue(ctx);

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

export async function getSubmissionParams(ctx: TaskContext, chain: Chain): Promise<TxSubmissionParams> {
  if (chain.id == mainnet.id) {
    return getMainnetSubmissionParams(ctx);
  } else if (chain.id == sepolia.id) {
    return getMainnetSepoliaSubmissionParams(ctx);
  } else {
    throw Error(`Invalid chain ${chain.id}`);
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
  } else if (id === berachain.id) {
    return berachain;
  } else if (id == sepolia.id) {
    return sepolia;
  }
  else throw new Error("unsupported chain");
}
  