import { createTaskRunner } from '@mountainpath9/overlord-core';

import { batchLiquidate } from '@/tlc/batch-liquidate';
import { TLC_BATCH_LIQUIDATE_CONFIG } from '@/tlc/config';
import { discordNotifyTaskException } from '@/common/discord';

async function main() {
  const runner = createTaskRunner();

  runner.setVersion(process.env.VERSION || 'unknown');
  runner.setTaskExceptionHandler(discordNotifyTaskException);

  runner.addPeriodicTask({
    id: 'tlc-batch-liquidate',
    cronSchedule: '*/10 * * * *',
    action: async (ctx) => await batchLiquidate(ctx, TLC_BATCH_LIQUIDATE_CONFIG),
  });

  runner.main();
}

main();
