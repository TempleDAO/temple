import {
  createTaskRunner,
  getAllVariableMetadata,
} from '@mountainpath9/overlord-core';

import { batchLiquidate } from '@/tlc/batch-liquidate';
import { TLC_BATCH_LIQUIDATE_CONFIG } from '@/tlc/config';

import { getConfig } from '@/config';
import { taskExceptionHandler } from './utils/task-exceptions';
import {
  distributeStakingRewards,
  startStableGoldAuction,
  checkSignersBalance,
  updateTemplePriceSidebarBotTask,
  startSepoliaStableGoldAuction,
  distributeSepoliaStakingRewards,
  checkSepoliaSignersBalance,
  burnAndUpdateCirculatingSupplySepolia,
  burnAndUpdateCirculatingSupply,
} from './tasks';
import { startTemplePriceSidebarBot } from './tasks/discord-bots/temple-price';
import { GRANARY_DEPLOYMENTS } from './tasks/granary/config';
import { granaryTasks } from './tasks/granary/tasks';

async function main() {
  const runner = createTaskRunner();

  runner.setVersion(process.env.VERSION || 'unknown');
  runner.setTaskExceptionHandler(taskExceptionHandler);
  runner.setConfigVariables(getAllVariableMetadata());

  runner.addPeriodicTask({
    id: 'tlc-batch-liquidate',
    cronSchedule: '*/10 * * * *',
    action: async (ctx) =>
      await batchLiquidate(ctx, TLC_BATCH_LIQUIDATE_CONFIG),
  });

  const config = getConfig('mainnet');
  const sepoliaConfig = getConfig('sepolia');

  const templePriceSidebarBot = await startTemplePriceSidebarBot(runner);
  // dai gold auction start
  runner.addPeriodicTask({
    id: 'start-stable-gold-auction',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) => startStableGoldAuction(config, ctx),
  });

  // distribute staking rewards
  runner.addPeriodicTask({
    id: 'distribute-staking-rewards',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) => distributeStakingRewards(config, ctx),
  });

  runner.addPeriodicTask({
    id: 'check-accounts-balance',
    cronSchedule: '0 * * * *', // 0 minute of every hour
    action: async (ctx, _time) => checkSignersBalance(config, ctx),
  });

  // Granary auction and wish notifications, one pair per deployment.
  for (const deployment of GRANARY_DEPLOYMENTS)
    for (const task of granaryTasks(deployment))
      runner.addPeriodicTask({
        ...task,
        cronSchedule: '*/20 * * * *',
        allowConcurrent: false,
      });

  runner.addPeriodicTask({
    id: 'update-temple-price-sidebar-bot',
    cronSchedule: '*/10 * * * *',
    action: (ctx) =>
      updateTemplePriceSidebarBotTask(config, ctx, templePriceSidebarBot),
  });

  // burn and notify TGLD for redemption
  runner.addPeriodicTask({
    id: 'burn-and-notify-tgld',
    cronSchedule: '0 */8 * * *', // once every 8 hours
    action: async (ctx, _time) => burnAndUpdateCirculatingSupply(config, ctx),
  });

  // Seploia tasks
  // dai gold auction start
  runner.addPeriodicTask({
    id: 'start-stable-gold-auction-sepolia',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) =>
      startSepoliaStableGoldAuction(sepoliaConfig, ctx),
  });

  // distribute staking rewards
  runner.addPeriodicTask({
    id: 'distribute-staking-rewards-sepolia',
    cronSchedule: '*/5 * * * *', // every 5 minutes
    action: async (ctx, _time) =>
      distributeSepoliaStakingRewards(sepoliaConfig, ctx),
  });

  runner.addPeriodicTask({
    id: 'check-accounts-balance-sepolia',
    cronSchedule: '0 * * * *', // 0 minute of every hour
    action: async (ctx, _time) =>
      checkSepoliaSignersBalance(sepoliaConfig, ctx),
  });

  // burn and notify TGLD for redemption
  runner.addPeriodicTask({
    id: 'burn-and-notify-tgld-sepolia',
    cronSchedule: '0 */8 * * *', // once every 8 hours
    action: async (ctx, _time) =>
      burnAndUpdateCirculatingSupplySepolia(sepoliaConfig, ctx),
  });

  runner.main();
}

main();
