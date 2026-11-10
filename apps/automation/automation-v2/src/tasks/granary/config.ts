import { StringVariable } from '@mountainpath9/overlord-core';
import type { Address, Chain } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * One Granary deployment. Its Overlord variables are prefixed with `network`,
 * so deployments in one runner never share settings or cursors.
 */
export interface GranaryDeployment {
  /** Short name used in task IDs and config variable names. */
  network: string;
  /** The chain, including its block explorer for transaction links. */
  chain: Chain;
  /** Subgraph indexing this deployment, pinned to a version with every field the tasks read. */
  subgraphUrl: string;
  fixedPriceAuctionFactory: Address;
  wishingWell: Address;
  vars: ReturnType<typeof granaryVariables>;
}

function granaryVariables(network: string) {
  const name = (suffix: string) => `granary_${network}_${suffix}`;

  return {
    webhookUrl: new StringVariable({
      name: name('notifications_webhook_url'),
      description: `Discord webhook for Granary announcements on ${network}. Leave unset to disable them.`,
      isSecret: true,
    }),
    moonwatcherRoleId: new StringVariable({
      name: name('moonwatcher_role_id'),
      description: `Discord role to mention on each ${network} auction announcement.`,
    }),
    wisherRoleId: new StringVariable({
      name: name('wisher_role_id'),
      description: `Discord role to mention on each ${network} Wishing Well announcement.`,
    }),
    auctionUrlTemplate: new StringVariable({
      name: name('auction_url_template'),
      description: `${network} auction page URL containing {id}, {address} or {epoch} placeholders.`,
    }),
  };
}

/** Defines a deployment and its network-prefixed config variables. */
export function defineGranaryDeployment(
  config: Omit<GranaryDeployment, 'vars'>
): GranaryDeployment {
  return { ...config, vars: granaryVariables(config.network) };
}

export const GRANARY_SEPOLIA = defineGranaryDeployment({
  network: 'sepolia',
  chain: sepolia,
  subgraphUrl:
    'https://api.goldsky.com/api/public/project_cmgzm4q1q009c5np2angrczxw/subgraphs/spice-bazaar-sepolia/v0.6.1/gn',
  fixedPriceAuctionFactory: '0x3DF8314F17bfC2B1141210f3D18e2524a958A745',
  wishingWell: '0x3136A2Dd08dB68aB4Ce425A44a7F63084eB9668e',
});

/** Deployments the production runner serves. */
export const GRANARY_DEPLOYMENTS: readonly GranaryDeployment[] = [
  GRANARY_SEPOLIA,
];
