import { Logger, TaskContext, TaskException } from '@mountainpath9/overlord';
import { WebhookClient, MessageCreateOptions } from 'discord.js';

interface DiscordChannel {
  postMessage(mesasge: DiscordMesage): Promise<void>;
}

export type DiscordMesage = MessageCreateOptions;

export async function connectDiscord(
  webhookUrl: string,
  logger: Logger
): Promise<DiscordChannel> {
  const params = decodeWebhookUrl(webhookUrl);
  const webhookClient = new WebhookClient(params);

  async function postMessage(message: DiscordMesage): Promise<void> {
    logger.info(`sending message to discord webhook ${params.id}`);
    await webhookClient.send(message);
  }

  return {
    postMessage,
  };
}

export function decodeWebhookUrl(url: string): { id: string; token: string } {
  const m = url.match(DISCORD_URL_RE);
  if (!m) {
    throw new Error('Unable to decode discord webhook url');
  }
  return { id: m[1], token: m[2] };
}

export async function discordNotifyTaskException(ctx: TaskContext, te: TaskException) {
  const content = [
    `**TEMPLE Task Failed**`,
    `task label: ${te.label}`,
    `task id: ${te.taskId}`,
    `task phase: ${te.phase}`,
  ];

  if (te.exception instanceof Error) {
    content.push(`exception type: Error`);
    // We truncate the message here as discord doesn't like large contents
    const message =
      te.exception.message.length > 997
        ? te.exception.message.substring(0, 997) + '...'
        : te.exception.message;
    content.push(`exception message: ${message}`);
  } else {
    content.push(`exception type: unknown`);
  }

  const webhookUrl = await ctx.getSecret(DISCORD_WEBHOOK_ERROR_URL_KEY);
  const discord = await connectDiscord(webhookUrl, ctx.logger);
  await discord.postMessage({ content: content.join('\n') });
}

const DISCORD_URL_RE = new RegExp(
  'https://discord.com/api/webhooks/([^/]+)/(.+)$'
);

export const DISCORD_WEBHOOK_URL_KEY = 'temple_tlc_discord_webhook_url';
export const DISCORD_WEBHOOK_ERROR_URL_KEY = 'temple_tlc_discord_error_webhook_url';
