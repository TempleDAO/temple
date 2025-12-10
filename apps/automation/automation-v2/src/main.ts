import { createTaskRunner, getAllVariableMetadata } from "@mountainpath9/overlord-core";

import { batchLiquidate } from '@/tlc/batch-liquidate';
import { TLC_BATCH_LIQUIDATE_CONFIG } from '@/tlc/config';

import { getConfig } from "@/config";
import { taskExceptionHandler } from "./utils/task-exceptions";
import * as vars from "./config/variables";
import {
  distributeStakingRewards, startStableGoldAuction, checkSignersBalance, updateAuctionSidebarBotTask,
  startSepoliaStableGoldAuction, distributeSepoliaStakingRewards, checkSepoliaSignersBalance,
  redeemTempleGoldSepolia,
  redeemTempleGold
} from "./tasks";
import { startSidebarBot } from "./tasks/discord-sidebar-auction";

async function main() {
  const runner = createTaskRunner();

  runner.setVersion(process.env.VERSION || 'unknown');
  runner.setTaskExceptionHandler(taskExceptionHandler);
  runner.setConfigVariables(getAllVariableMetadata());

  runner.addPeriodicTask({
    id: 'tlc-batch-liquidate',
    cronSchedule: '*/10 * * * *',
    action: async (ctx) => await batchLiquidate(ctx, TLC_BATCH_LIQUIDATE_CONFIG),
  });

  const config = getConfig('mainnet');
  const sepoliaConfig = getConfig('sepolia');

  const sidebarBot = await startSidebarBot(runner);
  // dai gold auction start
  runner.addPeriodicTask({
    id: 'start-stable-gold-auction',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) => startStableGoldAuction(config, ctx)
  });

  // distribute staking rewards
  runner.addPeriodicTask({
    id: 'distribute-staking-rewards',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) => distributeStakingRewards(config, ctx)
  });

  runner.addPeriodicTask({
    id: 'check-accounts-balance',
    cronSchedule: '0 * * * *', // 0 minute of every hour
    action: async (ctx, _time) => checkSignersBalance(config, ctx)
  });

  runner.addPeriodicTask({
    id: 'update-auction-sidebar-bot',
    cronSchedule: '*/15 * * * *', // every 15 minutes
    action: (ctx) => updateAuctionSidebarBotTask(config, ctx, sidebarBot)
  });
  
  // burn and notify TGLD for redemption
  runner.addPeriodicTask({
    id: 'redeem-tgld',
    cronSchedule: '0 */8 * * *', // once every 8 hours
    action: async (ctx, _time) => redeemTempleGold(config, ctx)
  });

  // Seploia tasks
  // dai gold auction start
  runner.addPeriodicTask({
    id: 'start-stable-gold-auction-sepolia',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) => startSepoliaStableGoldAuction(sepoliaConfig, ctx)
  });

  // distribute staking rewards
  runner.addPeriodicTask({
    id: 'distribute-staking-rewards-sepolia',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) => distributeSepoliaStakingRewards(sepoliaConfig, ctx)
  });

  runner.addPeriodicTask({
    id: 'check-accounts-balance-sepolia',
    cronSchedule: '0 * * * *', // 0 minute of every hour
    action: async (ctx, _time) => checkSepoliaSignersBalance(sepoliaConfig, ctx)
  });

  // burn and notify TGLD for redemption
  runner.addPeriodicTask({
    id: 'redeem-tgld-sepolia',
    cronSchedule: '0 */8 * * *', // once every 8 hours
    action: async (ctx, _time) => redeemTempleGoldSepolia(sepoliaConfig, ctx)
  });

  runner.main();
}

main();
