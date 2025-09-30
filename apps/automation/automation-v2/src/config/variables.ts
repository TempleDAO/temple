import { StringVariable, NumberVariable } from "@mountainpath9/overlord-core";
import { BigRationalVariable } from "./types";

export const env = new StringVariable({
    name: 'env',
    description: 'The contract environment in use (either testnet or arbitrumOne).',
});

export const error_webhook_url = new StringVariable({
    name: 'error_webhook_url',
    description: 'If configured, automation failures will be send to discord via this hook.',
    isSecret: true,
});

// ----------\-----------------------------------------\
// ----------\ stable gold auction variables -------------\

export const stablegoldauction_start_auction_max_gas_price = new BigRationalVariable({
    name: 'stablegoldauction_start_auction_max_gas_price',
    description: 'Skip a auction start if the gas price is greater than this. ',
    default: 200,
    min: 0,
    max: 1000,
});

export const start_stable_gold_auction_check_period_ms = new NumberVariable({
    name: 'start_stable_gold_auction_check_period_ms ',
    description: 'How many milliseconds to wait between start stable gold auction checks.',
    default: 1000 * 1200,
    min: 1000 * 600,
});

export const staking_distribute_rewards_check_period_ms = new NumberVariable({
    name: 'staking_distribute_rewards_check_period_ms ',
    description: 'How many milliseconds to wait between staking distribute rewards checks.',
    default: 1000 * 1200,
    min: 1000 * 600,
});

export const staking_distribute_rewards_max_gas_price = new BigRationalVariable({
    name: 'staking_distribute_rewards_max_gas_price',
    description: 'Max gas price for staking rewards distribution',
    default: 0.2,
    min: 0,
    max: 2
});

export const check_signers_balance_min_balance = new BigRationalVariable({
    name: 'check_signers_balance_min_balance',
    description: 'Min balance for signers',
    default: 0.1,
    min: 0,
    max: 2
});

export const check_signers_balance_check_period_ms = new NumberVariable({
    name: 'check_signers_balance_check_period_ms ',
    description: 'How many milliseconds to wait between signers balance checks.',
    default: 1000 * 3600,
    min: 1000 * 1800,
});

export const eth_mainnet_lz_eid = new NumberVariable({
    name: 'eth_mainnet_lz_eid',
    description: 'Ethereum mainnet layer zero EID',
    default: 30101
});

export const sepolia_lz_eid = new NumberVariable({
    name: 'sepolia_lz_eid',
    description: 'Sepolia layer zero EID',
    default: 40161
});

export const mint_chain_id = new NumberVariable({
    name: 'mint_chain_id',
    description: 'Mint chain Id',
    default: 1
});

export const mint_chain_id_sepolia = new NumberVariable({
    name: 'mint_chain_id_sepolia',
    description: 'Mint chain Id for testnet',
    default: 11155111
});

export const sepolia_tgld_max_gas_price = new BigRationalVariable({
    name: 'sepolia_tgld_max_gas_price',
    description: 'Max gas price for sepolia tgld transactions',
    default: 0.2,
    min: 0,
    max: 2
});

export const discord_thread_defcon_1 = new StringVariable({
  name: 'discord_thread_defcon_1',
  description: 'Discord thread ID where DEFCON 1 alerts  are dispatched',
});

export const discord_thread_defcon_2 = new StringVariable({
  name: 'discord_thread_defcon_2',
  description: 'Discord thread ID where DEFCON 2 alerts are dispatched',
});

export const discord_thread_defcon_3 = new StringVariable({
  name: 'discord_thread_defcon_3',
  description: 'Discord thread ID where DEFCON 3 alerts are dispatched',
});

export const discord_thread_defcon_4 = new StringVariable({
  name: 'discord_thread_defcon_4',
  description: 'Discord thread ID where DEFCON 4 alerts are dispatched',
});

export const discord_thread_defcon_5 = new StringVariable({
  name: 'discord_thread_defcon_5',
  description: 'Discord thread ID where DEFCON 5 alerts are dispatched',
});

export const webhook_url = new StringVariable({
  name: 'webhook_url',
  description: 'If configured, automation notifications will be send to discord via this hook.',
  isSecret: true,
});

export const redeem_tgld_max_gas_price = new BigRationalVariable({
    name: 'redeem_tgld_max_gas_price',
    description: 'Max gas price for redeeming TGLD after auction',
    default: 0.2,
    min: 0,
    max: 2
});

export const redeem_tgld_check_period_ms = new NumberVariable({
    name: 'redeem_tgld_check_period_ms ',
    description: 'How many milliseconds to wait between redeem TGLD checks.',
    default: 1000 * 1200,
    min: 1000 * 600,
});