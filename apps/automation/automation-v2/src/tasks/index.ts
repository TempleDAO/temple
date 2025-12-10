import { chainFromId, Config } from "@/config";
import { TaskContext, taskSuccessSilent } from "@mountainpath9/overlord-core";
import * as vars from "@/config/variables";
import { JB_DATE, JB_BIGRATIONAL, kvPersistedValue } from "@/utils/kv";
import { distributeGold } from "./stable-gold-auction-distribute-gold";
import { stakingDistributeRewards } from "./staking-distribute-rewards";
import { startAuction } from "./stable-gold-auction-start";
import { checkSignersEthBalance } from "./check-signers-eth-balance";
import { Client } from "discord.js";
import { getOnchainTgldAuctionState, updateDiscordSidebarBot } from "./discord-sidebar-auction";
import { redeemTempleGold as tgldRedemption} from "./spice-auction-burn-and-notify";
import { getPublicClient } from "@mountainpath9/overlord-viem";

////////////////////////////
// stable-gold-auction     //
////////////////////////////

export async function daiGoldAuctionDistributeGold(config: Config, ctx: TaskContext) {
    return distributeGold(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { stableGoldAuction: config.contracts.TEMPLE_GOLD.STABLE_GOLD_AUCTION, 
            templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD, staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING },
        lastRunTime: kvPersistedValue(ctx, 'daigoldauction_distribute_gold_last_run_time', JB_DATE),
        maxGasPrice: await vars.stablegoldauction_start_auction_max_gas_price.requireValue(ctx),
        checkPeriodMs:  await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

export async function distributeStakingRewards(config: Config, ctx: TaskContext) {
    return stakingDistributeRewards(ctx, {
        signerId: config.stakingSignerId,
        chainId: config.chainId,
        contracts: { stableGoldAuction: config.contracts.TEMPLE_GOLD.STABLE_GOLD_AUCTION,
            staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_staking_distribute_rewards_last_run_time', JB_DATE),
        maxGasPrice: await vars.staking_distribute_rewards_max_gas_price.requireValue(ctx),
        checkPeriodFinish: true,
        checkPeriodMs:  await vars.staking_distribute_rewards_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_staking_distribute_rewards_last_check_time', JB_DATE),
    });
}

export async function distributeSepoliaStakingRewards(config: Config, ctx: TaskContext) {
    return stakingDistributeRewards(ctx, {
        signerId: config.stakingSignerId,
        chainId: config.chainId,
        contracts: { stableGoldAuction: config.contracts.TEMPLE_GOLD.STABLE_GOLD_AUCTION,
            staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'sepolia_tgld_staking_distribute_rewards_last_run_time', JB_DATE),
        maxGasPrice: await vars.sepolia_tgld_max_gas_price.requireValue(ctx),
        checkPeriodFinish: true,
        checkPeriodMs:  await vars.staking_distribute_rewards_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'sepolia_tgld_staking_distribute_rewards_last_check_time', JB_DATE),
    });
}

export async function startStableGoldAuction(config: Config, ctx: TaskContext) {
    return startAuction(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { stableGoldAuction: config.contracts.TEMPLE_GOLD.STABLE_GOLD_AUCTION },
        lastRunTime: kvPersistedValue(ctx, 'tgld_start_daigold_auction_last_run_time', JB_DATE),
        maxGasPrice: await vars.stablegoldauction_start_auction_max_gas_price.requireValue(ctx),
        checkPeriodMs:  await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

export async function startSepoliaStableGoldAuction(config: Config, ctx: TaskContext) {
    return startAuction(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { stableGoldAuction: config.contracts.TEMPLE_GOLD.STABLE_GOLD_AUCTION },
        lastRunTime: kvPersistedValue(ctx, 'sepolia_tgld_start_daigold_auction_last_run_time', JB_DATE),
        maxGasPrice: await vars.sepolia_tgld_max_gas_price.requireValue(ctx),
        checkPeriodMs:  await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'sepolia_tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

export async function checkSignersBalance(config: Config, ctx: TaskContext) {
    const signers = [
        {
            signer: config.stableGoldAuctionSignerId,
            prevBalance: kvPersistedValue(ctx, 'tgld_daigold_auction_signer_prev_balance', JB_BIGRATIONAL),
        },
        {
            signer: config.stakingSignerId,
            prevBalance: kvPersistedValue(ctx, 'tgld_staking_signer_prev_balance', JB_BIGRATIONAL),
        }
    ]
    return checkSignersEthBalance(ctx, {
        chainId: config.chainId,
        signersWithPrevBalance: signers,
        lastRunTime: kvPersistedValue(ctx, 'tgld_check_signers_balance_last_run_time', JB_DATE),
        minBalance: await vars.check_signers_balance_min_balance.requireValue(ctx),
        checkPeriodMs:  await vars.check_signers_balance_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_check_signers_balance_last_check_time', JB_DATE),
    });
}

export async function checkSepoliaSignersBalance(config: Config, ctx: TaskContext) {
    // using same mainnet signers
    const signers = [
        {
            signer: config.stableGoldAuctionSignerId,
            prevBalance: kvPersistedValue(ctx, 'sepolia_tgld_daigold_auction_signer_prev_balance', JB_BIGRATIONAL),
        },
        {
            signer: config.stakingSignerId,
            prevBalance: kvPersistedValue(ctx, 'sepolia_tgld_staking_signer_prev_balance', JB_BIGRATIONAL),
        }
    ];
    return checkSignersEthBalance(ctx, {
        chainId: config.chainId,
        signersWithPrevBalance: signers,
        lastRunTime: kvPersistedValue(ctx, 'sepolia_tgld_check_signers_balance_last_run_time', JB_DATE),
        minBalance: await vars.check_signers_balance_min_balance.requireValue(ctx),
        checkPeriodMs:  await vars.check_signers_balance_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'sepolia_tgld_check_signers_balance_last_check_time', JB_DATE),
    });
}

export async function updateAuctionSidebarBotTask(config: Config, ctx: TaskContext, bot: Client | undefined) {
    if (!bot) {
        ctx.logger.info(`Discord sidebar bot not provided.`)
        return taskSuccessSilent()
    }
    const chain = chainFromId(config.chainId);
    const pclient = await getPublicClient(ctx, chain);
    const getTgldAuctionState = () => getOnchainTgldAuctionState(config.contracts.TEMPLE_GOLD.STABLE_GOLD_AUCTION, pclient)

    await updateDiscordSidebarBot({
        bot, getTgldAuctionState, logger: ctx.logger
    })

    return taskSuccessSilent();
}

export async function redeemTempleGoldSepolia(config: Config, ctx: TaskContext) {
    return tgldRedemption(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { spice: config.contracts.TEMPLE_GOLD.SPICE_DAI_TGLD,
            templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'sepolia_tgld_redeem_tgld_last_run_time', JB_DATE),
        maxGasPrice: await vars.redeem_tgld_max_gas_price.requireValue(ctx),
        checkPeriodMs: await vars.redeem_tgld_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'sepolia_tgld_redeem_tgld_last_check_time', JB_DATE),
        mint_source_lz_eid: await vars.sepolia_lz_eid.requireValue(ctx),
        mint_chain_id: await vars.mint_chain_id_sepolia.requireValue(ctx),
    });
}

export async function redeemTempleGold(config: Config, ctx: TaskContext) {
    return tgldRedemption(ctx, {
        chainId: config.chainId,
        signerId: config.stakingSignerId,
        contracts: { spice: config.contracts.TEMPLE_GOLD.SPICE_ENA_TGLD,
            templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD }, 
        lastRunTime: kvPersistedValue(ctx, 'tgld_redeem_tgld_last_run_time', JB_DATE),
        maxGasPrice: await vars.redeem_tgld_max_gas_price.requireValue(ctx),
        checkPeriodMs: await vars.redeem_tgld_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_redeem_tgld_last_check_time', JB_DATE),
        mint_source_lz_eid: await vars.eth_mainnet_lz_eid.requireValue(ctx),
        mint_chain_id: await vars.mint_chain_id.requireValue(ctx),
    });
}
