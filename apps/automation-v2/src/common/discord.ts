import { Logger } from "@mountainpath9/overlord";
import { WebhookClient, MessageCreateOptions } from "discord.js";


interface DiscordChannel {
  postMessage(mesasge: DiscordMesage): Promise<void>;
}

export type DiscordMesage = MessageCreateOptions;


export async function connectDiscord(webhookUrl: string, logger: Logger): Promise<DiscordChannel> {
  const params = decodeWebhookUrl(webhookUrl);
  const webhookClient = new WebhookClient(params);

  async function postMessage(message: DiscordMesage): Promise<void> {
    logger.info(`sending message to discord webhook ${params.id}`);
    await webhookClient.send(message);
  }

  return {
    postMessage
  }
}

export function decodeWebhookUrl(url: string): { id: string, token: string } {
  const m = url.match(DISCORD_URL_RE);
  if (!m) {
    throw new Error("Unable to decode discord webhook url");
  }
  return { id: m[1], token: m[2] };
}

const DISCORD_URL_RE = new RegExp('https://discord.com/api/webhooks/([^/]+)/(.+)$');

export const DISCORD_WEBHOOK_URL_KEY = "temple_discord_webhook_url";