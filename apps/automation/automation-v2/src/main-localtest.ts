import { TaskContext, TaskResult, createTaskRunner,
    getAllVariableMetadata, taskSuccess } from "@mountainpath9/overlord-core";
import { Config, getConfig } from "@/config";
import { taskExceptionHandler } from "./utils/task-exceptions";
import * as stableGoldAuctionStart from "./tasks/stable-gold-auction-start";
import * as stableGoldAuctionDistributeTgld from "./tasks/stable-gold-auction-distribute-gold";
import { checkSignersEthBalance } from "./tasks/check-signers-eth-balance";
import * as vars from "@/config/variables";
import { JB_BIGRATIONAL, JB_DATE, kvPersistedValue } from "@/utils/kv";
import * as stakingDistributeRewardsa from "./tasks/staking-distribute-rewards";
import * as templeGoldRedeem from "./tasks/spice-auction-burn-and-notify";
import { startSidebarBot } from "./tasks/discord-sidebar-auction";
import { updateAuctionSidebarBotTask } from "./tasks";

async function main() {
    const runner = createTaskRunner();
    const env = await runner.config.requireString(vars.env.name());
    const config = getConfig(env);

    runner.setTaskExceptionHandler(taskExceptionHandler);
    console.log("setting variables");
    runner.setConfigVariables(getAllVariableMetadata());

    const discordAuctionBot = await startSidebarBot(runner)
    runner.addWebhookTask({
        id: stableGoldAuctionStart.taskIdPrefix + 'start',
        action: (ctx) => stableGoldAuctionStartAuction(config, ctx),
    });

    runner.addWebhookTask({
        id: stableGoldAuctionDistributeTgld.taskIdPrefix + 'distribute',
        action: (ctx) => stableGoldAuctionDistributeGold(config, ctx),
    });

    runner.addWebhookTask({
        id: stakingDistributeRewardsa.taskIdPrefix + 'distribute',
        action: (ctx) => stakingDistributeRewards(config, ctx),
    });

    runner.addWebhookTask({
        id: templeGoldRedeem.taskIdPrefix + 'redeem',
        action: (ctx) => burnTempleGold(config, ctx),
    });

    // We need a periodic task to keep the task runner alive
    runner.addPeriodicTask({
        id: 'keepalive',
        cronSchedule: '0 * * * *',
        action: async (_ctx) => {
            return taskSuccess();
        }
    });

    runner.addWebhookTask({
        id: 'refresh-auction-bot',
        action: (ctx)=> updateAuctionSidebarBotTask(config, ctx, discordAuctionBot)
    })
    runner.main();
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

export async function stableGoldAuctionStartAuction(config: Config, ctx: TaskContext) {
    return stableGoldAuctionStart.startAuction(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { auction: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_start_daigold_auction_last_run_time', JB_DATE),
        maxGasPrice: await vars.stablegoldauction_start_auction_max_gas_price.requireValue(ctx),
        checkPeriodMs: await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

export async function stableGoldAuctionDistributeGold(config: Config, ctx: TaskContext) {
    return stableGoldAuctionDistributeTgld.distributeGold(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { auction: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD, 
        templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD, staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING },
        lastRunTime: kvPersistedValue(ctx, 'daigoldauction_distribute_gold_last_run_time', JB_DATE),
        maxGasPrice: await vars.stablegoldauction_start_auction_max_gas_price.requireValue(ctx),
        checkPeriodMs: await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

export async function stakingDistributeRewards(config: Config, ctx: TaskContext): Promise<TaskResult> {
    return stakingDistributeRewardsa.stakingDistributeRewards(ctx, {
        signerId: config.stakingSignerId,
        chainId: config.chainId,
        contracts: { staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_staking_distribute_rewards_last_run_time', JB_DATE),
        maxGasPrice: await vars.staking_distribute_rewards_max_gas_price.requireValue(ctx),
        checkPeriodFinish: true,
        checkPeriodMs:  await vars.staking_distribute_rewards_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_staking_distribute_rewards_last_check_time', JB_DATE),
    });
}

export async function burnTempleGold(config: Config, ctx: TaskContext) {
    return templeGoldRedeem.burnAndUpdateCirculatingSupply(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { auction: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_SPICE.DAI,
            templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_redeem_tgld_last_run_time', JB_DATE),
        maxGasPrice: await vars.sepolia_tgld_max_gas_price.requireValue(ctx),
        checkPeriodMs:  await vars.redeem_tgld_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_redeem_tgld_last_check_time', JB_DATE),
        mint_source_lz_eid: BigInt(await vars.eth_mainnet_lz_eid.requireValue(ctx)),
        mint_chain_id: BigInt(await vars.mint_chain_id.requireValue(ctx)),
    });
}

main();