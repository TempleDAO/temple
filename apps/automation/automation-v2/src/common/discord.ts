import { ERROR_INTERFACES, mapParsedEthersException } from '@/common/ethers-exceptions';



import { Logger, StringVariable, TaskContext, TaskException, logTaskException } from '@mountainpath9/overlord-core';
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

export async function discordNotifyTaskException(ctx: TaskContext, te0: TaskException) {
  // Map custom errors for our contracts to be human readable
  const te = { ...te0, exception: mapParsedEthersException(te0.exception, ERROR_INTERFACES) };

  // Log failure to overlord
  await logTaskException(ctx, te);

  const tsyOpsRoleId = await discord_error_role_id.getValue(ctx);
  const content = [
    `<@&${tsyOpsRoleId}>`, // discord role id to be tagged
    `**TEMPLE Task Failed**`,
    `task label: ${te.label}`,
    `task id: ${te.taskId}`,
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

  const webhookUrl = await discord_error_webhook_url.getValue(ctx);
  if (webhookUrl) {
    const discord = await connectDiscord(webhookUrl, ctx.logger);
    await discord.postMessage({ content: content.join('\n') });
  }
}

const DISCORD_URL_RE = new RegExp(
  'https://discord.com/api/webhooks/([^/]+)/(.+)$'
);

const discord_error_webhook_url = new StringVariable({
    name: 'discord_error_webhook_url',
    description: 'webhook url for the discord channel to which we send task failures',
    isSecret: true,
});

const discord_error_role_id = new StringVariable({
    name: 'discord_error_role_id',
    description: 'role id to be tagged when sending discord error notification',
});

