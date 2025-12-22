import { format } from 'date-fns';
import { Chain } from './batch-liquidate';
import { DISCORD_TSY_OPS_TAG, DiscordMessage } from '@/utils/discord';
import { TransactionReceipt, formatUnits } from 'viem';
import { PublicClient } from '@mountainpath9/overlord-viem';
import { BigRational } from '@mountainpath9/big-rational';

export async function getBlockTimestamp(provider: PublicClient): Promise<bigint> {
  const latestBlock = await provider.getBlock();
  if (!latestBlock) throw new Error('undefined block');
  return BigInt(latestBlock.timestamp);
}

export function bpsToFraction(bps: number): number {
  // eg 100 -> 0.01 (1%)
  return bps / 10_000;
}

// Keep trying to run `fn` until it returns true, sleeping in between, and timeout after
// TOTAL_TIMEOUT_SECS
export const tryUntilTimeout = async (
  startUnixMilliSecs: number,
  config: TimeoutConfig,
  fn: () => Promise<boolean>
): Promise<boolean> => {
  const cooldownSleepMilliSecs = 1000 * config.WAIT_SLEEP_SECS;

  while (true) {
    const canRun = await fn();

    if (canRun) {
      return true;
    }

    // Bail if the next sleep would take us over the timeout
    const secsElapsed = (new Date().getTime() - startUnixMilliSecs) / 1000;
    if (secsElapsed + config.WAIT_SLEEP_SECS >= config.TOTAL_TIMEOUT_SECS) {
      return false;
    }

    // Sleep for WAIT_SLEEP_SECS then try again.
    await sleep(cooldownSleepMilliSecs);
  }
};

export interface TimeoutConfig {
  WAIT_SLEEP_SECS: number; // Number of seconds to sleep between retries to check when waiting for conditions to be met.
  TOTAL_TIMEOUT_SECS: number; // The total number of seconds the bot will wait for conditions to be met. Note the OZ autotask will fail noisily after 300 secs, so suggest failing slightly before that.
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function min(v1: number, v2: number): number {
  return v1 < v2 ? v1 : v2;
}

export function assertNever(x: never): never {
  throw new Error('Unexpected object: ' + x);
}

// String representation of a bigint, which is represented with a certain number of decimals
export function formatBigNumber(
  bn: bigint,
  dnDecimals: number,
  displayDecimals: number
): string {
  return formatNumber(Number(formatUnits(bn, dnDecimals)), displayDecimals);
}

// Format numbers with a certain number of decimal places, to locale
export function formatNumber(number: number, displayDecimals: number): string {
  const stringified = number.toString();
  const decimalPlaces = stringified.includes('.')
    ? stringified.split('.')[1].length
    : 0;

  return decimalPlaces >= displayDecimals
    ? number.toLocaleString('en-US', {
        minimumFractionDigits: displayDecimals,
      })
    : number.toLocaleString('en-US');
}

export const one_gwei = 1000000000n;

/**
 * Generate markdown for standard tx receipt fields
 */
export async function txReceiptMarkdown(
  provider: PublicClient,
  submittedAt: Date,
  txReceipt: TransactionReceipt,
  txUrl: string
): Promise<string[]> {
  const effectiveGasPrice = txReceipt.effectiveGasPrice; // In wei
  const gasUsed = txReceipt.gasUsed;
  const totalFee = (effectiveGasPrice * gasUsed) / one_gwei;
  const block = await provider.getBlock({ blockNumber: txReceipt.blockNumber });
  if (!block) throw new Error('undefined block');
  const timestampMs = Number(block.timestamp * 1000n);
  const minedAt = new Date(timestampMs);

  return [
    `_Gas Price (GWEI):_ \`${formatBigNumber(effectiveGasPrice, 9, 4)}\``,
    `_Gas Used:_ \`${formatBigNumber(gasUsed, 0, 0)}\``,
    `_Total Fee (ETH):_ \`${formatBigNumber(totalFee, 9, 8)}\``,
    `_Mined At (Local):_ \`${format(minedAt.getTime(), 'd MMMM Y HH:mm')}\``,
    `_Mined At Unix:_ \`${minedAt.getTime()}\``,
    `_Submitted At Unix:_ \`${submittedAt.getTime()}\``,
    `_Seconds To Mine:_ \`${
      (minedAt.getTime() - submittedAt.getTime()) / 1000
    }\``,
    ``,
    `${txUrl}`,
  ];
}

export type TempleTaskDiscordEventType = 'Liquidated';
export interface TempleTaskDiscordEvent {
  what: TempleTaskDiscordEventType;
  details: string[];
}
export interface TempleTaskDiscordMetadata {
  title: string;
  numberOfEvents: number;
  totalCollateralSeized: BigRational;
  totalDebtWiped: BigRational;
  submittedAt: Date;
  txReceipt: TransactionReceipt;
  txUrl: string;
}

/**
 *
 * Generate markdown for temple tasks discord
 */

export async function buildTempleTasksDiscordMessage(
  provider: PublicClient,
  chainName: string,
  metadata: TempleTaskDiscordMetadata
): Promise<DiscordMessage> {
  const { title, submittedAt, txReceipt, txUrl, numberOfEvents, totalCollateralSeized, totalDebtWiped } = metadata;

  // Reduce event details in message to avoid bloating up to character limits
  const content = [
    DISCORD_TSY_OPS_TAG,
    `**TEMPLE ${title} Event [${chainName}]**`,
    `\n${numberOfEvents} liquidation events in this transaction`,
    `\n${totalCollateralSeized.toDecimalString(2)} total TEMPLE collateral seized`,
    `\n${totalDebtWiped.toDecimalString(2)} total DAI debt wiped`,
    ``,
    ...(await txReceiptMarkdown(provider, submittedAt, txReceipt, txUrl)),
  ];

  return {
    content: content.join('\n'),
  };
}

export async function buildDiscordMessageCheckEth(
    chain: Chain,
    submittedAt: Date,
    watchAddress: string,
    ethBalance: bigint,
    minBalance: bigint
  ): Promise<DiscordMessage> {
    const content = [
      DISCORD_TSY_OPS_TAG,
      `**TEMPLE LOW ETH ALERT [${chain.name}]**`,
      ``,
      `_address:_ ${watchAddress}`,
      `_required eth:_ ${formatBigNumber(minBalance, 18, 6)}`,
      `_eth balance:_  ${formatBigNumber(ethBalance, 18, 6)}`,
      `_submitted at:_ ${submittedAt.toISOString()}`,
      ``,
      `${chain.addressUrl(watchAddress)}`,
    ];
  
    return {
      content: content.join('\n'),
    };
  }
