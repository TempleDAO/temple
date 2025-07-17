import { TaskContext, TaskException, logTaskException } from "@mountainpath9/overlord-core";
import { discordLogTaskException } from "./discord";
import * as vars from "@/config/variables";

export async function taskExceptionHandler(ctx: TaskContext, te: TaskException) {
  // Log failure to overlord
  await logTaskException(ctx, te);

  // Log failure to discord if configured
  const webhook_url = await vars.error_webhook_url.getValue(ctx);
  if (webhook_url) {
    discordLogTaskException(webhook_url, ctx, te);
  }
}
