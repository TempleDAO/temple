import { ContractAddresses} from "./contract_addresses/types";
import { CONTRACTS as TESTNET_CONTRACTS } from "./contract_addresses/anvil";
import { CONTRACTS as SEPOLIA_CONTRACTS } from "./contract_addresses/sepolia";
import { CONTRACTS as MAINNET_CONTRACTS } from "./contract_addresses/mainnet";
import { TxSubmissionParams } from "@mountainpath9/overlord-viem";
import { ethers } from "ethers";
import { Chain } from "viem";
import { mainnet, berachain, sepolia } from "viem/chains";


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

export const TX_SUBMISSION_PARAMS: TxSubmissionParams = {
  // our initial gas tip
  t0MaxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),

  // Wait for 30 secs before increasing tip
  t1Secs: 30,
  t1MaxPriorityFeePerGas: ethers.parseUnits('3', 'gwei'),

  // Don't bother cancelling, as flashbots does this automatically
  // at 300 seconds
  t2Secs: 300,
  t2MaxPriorityFeePerGas: undefined,

  // Wait for another 300s before giving up on cancellation
  t3Secs: 300
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
  