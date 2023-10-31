import { createTaskRunner, fallibleWebhookTask } from '@mountainpath9/overlord';

import { batchLiquidate } from '@/tlc/batch-liquidate';

import { CONFIG as CONFIG_TESTNETS } from '@/config/testnets';
import { CONFIG as CONFIG_PRODNETS } from '@/config/prodnets';

import { discordNotifyTaskException } from '@/common/discord';

async function main() {
  const runner = createTaskRunner();

  const mode = await runner.config.requireString('temple_tlc_networks');
  const isProdnet = mode === 'prodnets';
  const config = isProdnet ? CONFIG_PRODNETS : CONFIG_TESTNETS;

  runner.setTaskExceptionHandler(discordNotifyTaskException);

  runner.addPeriodicTask({
    id: 'tlc-batch-liquidate',
    cronSchedule: '*/10 * * * *',
    action: async (ctx) => await batchLiquidate(ctx, config.tlcBatchLiquidate),
  });

  runner.addWebhookTask(
    fallibleWebhookTask({
      id: 'tlc-batch-liquidate-wh',
      action: async (ctx) =>
        await batchLiquidate(ctx, config.tlcBatchLiquidate),
    })
  );

  runner.main();
}

main();
