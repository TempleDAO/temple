import { Logger, TaskContext, TaskException } from "@mountainpath9/overlord-core";
import { WebhookClient, WebhookMessageCreateOptions } from "discord.js";
import * as vars from "@/config/variables";

type NotificationLevel =
  | 'defcon1' // not used
  | 'defcon2' // not used
  | 'defcon3' // unexpected failures
  | 'defcon4' // actions explicitly aborted due to price checks etc.
  | 'defcon5'; // success notifications

interface DiscordChannel {
  postMessage(mesasge: DiscordMessage): Promise<void>;
}

export interface DiscordTarget {
  webhookUrl: string,
  threadId?: string,
  mentions: string[],
}


export type DiscordMessage = WebhookMessageCreateOptions;


export async function connectDiscord(webhookUrl: string, logger: Logger): Promise<DiscordChannel> {
  const params = decodeWebhookUrl(webhookUrl);
  const webhookClient = new WebhookClient(params);

  async function postMessage(message: DiscordMessage): Promise<void> {
    logger.info(`sending message to discord webhook ${params.id}`);
    await webhookClient.send(message);
  }

  return {
    postMessage
  }
}

export async function discordLogTaskException(webhookUrl: string, ctx: TaskContext, te: TaskException) {
  const content = [
    DISCORD_TSY_OPS_TAG,
    `**Automation Task Failed**`,
    `task runner: ${ctx.getRunnerLabel()}`,
    `task label: ${te.label}`,
    `task id: ${te.taskId}`,
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

  const discord = await connectDiscord(webhookUrl, ctx.logger);
  await discord.postMessage({ content: content.join('\n') });
}

export function decodeWebhookUrl(url: string): { id: string, token: string } {
  const m = url.match(DISCORD_URL_RE);
  if (!m) {
    throw new Error("Unable to decode discord webhook url");
  }
  return { id: m[1], token: m[2] };
}

async function getDiscordTarget(ctx: TaskContext, level: NotificationLevel): Promise<DiscordTarget | undefined> {
  const webhookUrl = await vars.webhook_url.getValue(ctx);
  if (!webhookUrl) {
    return;
  }
  let threadId: string | undefined;
  let mentions: string[] = [];
  switch (level) {
    case 'defcon1':
       threadId = await vars.discord_thread_defcon_1.getValue(ctx);
       mentions = [DISCORD_TSY_OPS_TAG];
       break;
    case 'defcon2':
       threadId = await vars.discord_thread_defcon_2.getValue(ctx);
       mentions = [DISCORD_TSY_OPS_TAG];
       break;
    case 'defcon3':
       threadId = await vars.discord_thread_defcon_3.getValue(ctx);
       mentions = [DISCORD_TSY_OPS_TAG];
       break;
    case 'defcon4':
       threadId = await vars.discord_thread_defcon_4.getValue(ctx);
       mentions = [];
       break;
    case 'defcon5':
       threadId = await vars.discord_thread_defcon_5.getValue(ctx);
       mentions = [];
       break;
  }
  return {
    webhookUrl,
    threadId,
    mentions
  };
}

export async function postDefconNotification(
  level: NotificationLevel,
  message: string,
  ctx: TaskContext
): Promise<boolean> {
  const discordDefconChannel = await getDiscordTarget(ctx, level);

  if (!discordDefconChannel) return false;

  const discord = await connectDiscord(
    discordDefconChannel.webhookUrl,
    ctx.logger
  );

  const header = `**${ctx.getRunnerLabel()}/${ctx.getTaskLabel()}**\n${discordDefconChannel?.mentions.join(' ')}`;

  await discord?.postMessage({
    content: [header, message].join('\n'),
    threadId: discordDefconChannel.threadId,
  });

  return true;
} 


export const DISCORD_TSY_OPS_TAG = `<@&929860072123797515>`;
const DISCORD_URL_RE = new RegExp('https://discord.com/api/webhooks/([^/]+)/(.+)$');