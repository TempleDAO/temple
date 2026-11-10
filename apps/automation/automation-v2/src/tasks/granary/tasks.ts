import {
  ConfigVariable,
  Json,
  TaskContext,
  TaskResult,
  taskSuccess,
  taskSuccessSilent,
} from '@mountainpath9/overlord-core';
import { getPublicClient } from '@mountainpath9/overlord-viem';
import { z } from 'zod';
import { createBaseApi } from '@/utils/api';
import { connectDiscord } from '@/utils/discord';
import { collectAuctionAnnouncements } from './auctions';
import { GranaryDeployment } from './config';
import { collectWishAnnouncements } from './wishes';
import { Announcement, batchAnnouncements, CursorStep } from './shared';
import {
  addressSchema,
  createGranarySubgraph,
  snapshotSchema,
} from './subgraph';

const auctionCursorKey = (d: GranaryDeployment) =>
  `granary/auctions/${d.chain.id}/${addressSchema.parse(d.fixedPriceAuctionFactory)}`;
const wishCursorKey = (d: GranaryDeployment) =>
  `granary/wishes/${d.chain.id}/${addressSchema.parse(d.wishingWell)}`;

/** `roleId` is undefined when messages go out without a mention. */
type Delivery = { webhookUrl: string; roleId: string | undefined };

/**
 * Discord delivery mentioning `role`, or undefined when the deployment's
 * webhook is unset (its notifications are disabled). An unset or malformed
 * role sends without a mention instead of failing the run.
 */
export async function loadDelivery(
  ctx: TaskContext,
  { vars }: GranaryDeployment,
  role: ConfigVariable<string>
): Promise<Delivery | undefined> {
  const webhookUrl = await vars.webhookUrl.getValue(ctx);
  if (!webhookUrl) return;

  const roleId = await role.getValue(ctx);
  if (roleId === undefined || roleId === '') {
    ctx.logger.warn(`${role.name()} is unset; sending without a mention`);
    return { webhookUrl, roleId: undefined };
  }
  if (!/^\d{17,20}$/.test(roleId)) {
    ctx.logger.warn(
      `${role.name()} is not a Discord role ID; sending without a mention`
    );
    return { webhookUrl, roleId: undefined };
  }

  return { webhookUrl, roleId };
}

/**
 * Posts announcements as embeds, up to 10 per message. The role mention goes
 * in the message text because mentions inside embeds do not notify anyone;
 * without a role the message carries only the embeds.
 */
export async function sendAnnouncements(
  ctx: TaskContext,
  { webhookUrl, roleId }: Delivery,
  announcements: Announcement[]
) {
  const batches = batchAnnouncements(announcements);
  if (!batches.length) return;

  try {
    const discord = await connectDiscord(webhookUrl, ctx.logger);

    for (const embeds of batches) {
      await discord.postMessage({
        content: roleId && `<@&${roleId}>`,
        embeds,
        allowedMentions: { parse: [], roles: roleId ? [roleId] : [] },
      });
    }
  } catch {
    // Discord errors can include the webhook token in their request details.
    throw new Error('Granary Discord delivery failed');
  }
}

/**
 * Applies one `CursorStep` to the KV cursor at `key`: a baseline or unchanged
 * step is silent; an advanced step sends its digest before saving the cursor,
 * so a failed send leaves the cursor for the next run to retry. Only a run
 * that sent something reports success.
 */
async function advanceCursor<Cursor extends Json>(
  ctx: TaskContext,
  delivery: Delivery,
  key: string,
  parse: (saved: Json) => Cursor,
  collect: (cursor: Cursor | undefined) => Promise<CursorStep<Cursor>>
) {
  const saved = await ctx.kvGet(key);
  const step = await collect(saved === undefined ? undefined : parse(saved));

  switch (step.kind) {
    case 'unchanged':
      return taskSuccessSilent();
    case 'baseline':
      await ctx.kvSet(key, step.cursor);
      return taskSuccessSilent();
    case 'advanced':
      await sendAnnouncements(ctx, delivery, step.announcements);
      await ctx.kvSet(key, step.cursor);
      return step.announcements.length ? taskSuccess() : taskSuccessSilent();
  }
}

async function granaryAuctionNotificationTask(
  ctx: TaskContext,
  deployment: GranaryDeployment
) {
  const delivery = await loadDelivery(
    ctx,
    deployment,
    deployment.vars.moonwatcherRoleId
  );
  if (!delivery) return taskSuccessSilent();

  const auctionUrlTemplate =
    await deployment.vars.auctionUrlTemplate.requireValue(ctx);

  return advanceCursor(
    ctx,
    delivery,
    auctionCursorKey(deployment),
    (saved) => snapshotSchema.parse(saved),
    (cursor) =>
      collectAuctionAnnouncements({
        subgraph: createGranarySubgraph(deployment.subgraphUrl),
        factory: addressSchema.parse(deployment.fixedPriceAuctionFactory),
        auctionUrlTemplate,
        explorerUrl: deployment.chain.blockExplorers?.default.url,
        cursor,
      })
  );
}

async function granaryWishNotificationTask(
  ctx: TaskContext,
  deployment: GranaryDeployment
) {
  const delivery = await loadDelivery(
    ctx,
    deployment,
    deployment.vars.wisherRoleId
  );
  if (!delivery) return taskSuccessSilent();

  const tokenApi = await createBaseApi(
    await getPublicClient(ctx, deployment.chain)
  );

  return advanceCursor(
    ctx,
    delivery,
    wishCursorKey(deployment),
    (saved) => z.number().int().nonnegative().parse(saved),
    (cursor) =>
      collectWishAnnouncements({
        subgraph: createGranarySubgraph(deployment.subgraphUrl),
        tokenApi,
        explorerUrl: deployment.chain.blockExplorers?.default.url,
        cursor,
      })
  );
}

/**
 * The notification tasks of one deployment. IDs end with its network, so
 * several deployments can share one runner.
 */
export function granaryTasks(deployment: GranaryDeployment): {
  id: string;
  action: (ctx: TaskContext) => Promise<TaskResult>;
}[] {
  return [
    {
      id: `granary-auction-notifications-${deployment.network}`,
      action: (ctx) => granaryAuctionNotificationTask(ctx, deployment),
    },
    {
      id: `granary-wish-notifications-${deployment.network}`,
      action: (ctx) => granaryWishNotificationTask(ctx, deployment),
    },
  ];
}
