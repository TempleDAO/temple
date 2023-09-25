
import {
    TaskContext,
    TaskException,
    createTaskRunner,
    fallibleWebhookTask,
    taskSuccess,
} from "@mountainpath9/overlord";

import { batchLiquidate } from "@/tlc/batch-liquidate";

import { CONFIG as CONFIG_TESTNETS } from "@/config/testnets";
import { CONFIG as CONFIG_PRODNETS } from "@/config/prodnets";

import { DISCORD_WEBHOOK_URL_KEY, connectDiscord } from "@/common/discord";
import { MAINNET, SEPOLIA } from "@/chains";
import { checkLowEthBalance } from "@/common/eth-auto-checker";
  
  
async function main() {
    const runner = createTaskRunner();

    const mode = await runner.config.requireString('temple_networks');
    const isProdnet = mode === 'prodnets';
    const config = isProdnet ? CONFIG_PRODNETS : CONFIG_TESTNETS;

    runner.setTaskExceptionHandler(discordNotifyTaskException);

    // const alertPausedTask = await createAlertPausedTask(runner, 'alert-paused-status', config.alertPausedStatus);
    // runner.addChainEventTask(fallibleChainEventTask(
    //     alertPausedTask
    // ));

    runner.addPeriodicTask({
        id: 'tlc-batch-liquidate',
        cronSchedule: '*/10 * * * *',
        action: async (ctx) => {
        await batchLiquidate(ctx, config.tlcBatchLiquidate);
        await checkLowEthBalance(ctx, config.checkEthBalance(isProdnet ? MAINNET : SEPOLIA));
        return taskSuccess();
        }
    });

    runner.addWebhookTask(fallibleWebhookTask({ 
        id: 'tlc-batch-liquidate-wh',
        action: async (ctx) => {
        await batchLiquidate(ctx, config.tlcBatchLiquidate);
        await checkLowEthBalance(ctx, config.checkEthBalance(isProdnet ? MAINNET : SEPOLIA));
        return taskSuccess();
        }
    }));

    runner.main();
  }
  
async function discordNotifyTaskException(ctx: TaskContext, te: TaskException) {
    const content = [
      `**TEMPLE Task Failed**`,
      `task label: ${te.label}`,
      `task id: ${te.taskId}`,
      `task phase: ${te.phase}`,
    ];
  
    if (te.exception instanceof Error) {
      content.push(`exception type: Error`);
      // We truncate the message here as discord doesn't like large contents
      const message 
        = te.exception.message.length > 997 
        ? te.exception.message.substring(0, 997) + "..." 
        : te.exception.message;
      content.push(`exception message: ${message}`);
    } else {
      content.push(`exception type: unknown`);
    }
  
    const webhookUrl = await ctx.getSecret(DISCORD_WEBHOOK_URL_KEY);
    const discord = await connectDiscord(webhookUrl, ctx.logger);
    await discord.postMessage({content: content.join('\n')});
}

main();
  