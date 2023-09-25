
import { BigNumber } from "ethers";
import { Provider, TransactionReceipt } from "@ethersproject/abstract-provider";
import * as ethers from "ethers";
import { TypedEventFilter, TypedEvent } from '@/typechain/common';
import { format } from 'date-fns';
import { Chain } from "@/chains";
import { DiscordMesage } from "./discord";

export async function getBlockTimestamp(provider: Provider): Promise<BigNumber> {
  const latestBlock = await provider.getBlock("latest");
  return BigNumber.from(latestBlock.timestamp);
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
  fn: () => Promise<boolean>,
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
}


export interface TimeoutConfig {
  WAIT_SLEEP_SECS: number, // Number of seconds to sleep between retries to check when waiting for conditions to be met.
  TOTAL_TIMEOUT_SECS: number, // The total number of seconds the bot will wait for conditions to be met. Note the OZ autotask will fail noisily after 300 secs, so suggest failing slightly before that.
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function min(v1: number, v2: number): number {
  return v1 < v2 ? v1 : v2;
}

export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x);
}
  
  // String representation of a BigNumber, which is represented with a certain number of decimals
  export function formatBigNumber(bn: ethers.BigNumber, dnDecimals: number, displayDecimals: number): string {
    return formatNumber(Number(ethers.utils.formatUnits(bn, dnDecimals)), displayDecimals);
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
  
  export const one_gwei = ethers.BigNumber.from("1000000000");
  
  
  /**
   * Apply a filter to an event, and, if it matches, return it's parsed
   * values 
   */
  export function matchAndDecodeEvent<TArgsArray extends unknown[], TArgsObject>(
    contract: ethers.BaseContract,
    eventFilter: TypedEventFilter<TypedEvent<TArgsArray, TArgsObject>>,
    event: ethers.Event): TArgsObject | undefined {
    if (matchTopics(eventFilter.topics, event.topics)) {
      const args = contract.interface.parseLog(event).args;
      return args as TArgsObject;
    }
    return undefined;
  }
  
  /**
   * Finds the events that match the specified address and filter, and
   * returns these parsed and mapped to the appropriate type
   */
  export function matchAndDecodeEvents<TArgsArray extends unknown[], TArgsObject>(
    events: ethers.Event[],
    contract: ethers.BaseContract,
    address: string | undefined,
    eventFilter: TypedEventFilter<TypedEvent<TArgsArray, TArgsObject>>
  ): TypedEvent<TArgsArray, TArgsObject>[] {
    return events
      .filter((ev) => !address || address === ev.address)
      .filter((ev) => matchTopics(eventFilter.topics, ev.topics))
      .map((ev) => {
        const args = contract.interface.parseLog(ev).args;
        const result: TypedEvent<TArgsArray, TArgsObject> = {
          ...ev,
          args: args as TArgsArray & TArgsObject,
        };
        return result;
      });
  }
  
  
  function matchTopics(
    filter: Array<string | Array<string>> | undefined,
    value: Array<string>
  ): boolean {
    // Implement the logic for topic filtering as described here:
    // https://docs.ethers.io/v5/concepts/events/#events--filters
    if (!filter) {
      return false;
    }
    for (let i = 0; i < filter.length; i++) {
      const f = filter[i];
      const v = value[i];
      if (typeof f == 'string') {
        if (f !== v) {
          return false;
        }
      } else {
        if (f.indexOf(v) === -1) {
          return false;
        }
      }
    }
    return true;
  }
  
  export function first<T>(values: T[]): T | undefined {
    return values.length >= 1 ? values[0] : undefined;
  }

  /**
 * Generate markdown for standard tx receipt fields
 */
export async function txReceiptMarkdown(
    provider: Provider,
    submittedAt: Date,
    txReceipt: TransactionReceipt,
    txUrl: string
  ): Promise<string[]> {
  
    const effectiveGasPrice = ethers.BigNumber.from(txReceipt.effectiveGasPrice); // In wei
    const gasUsed = ethers.BigNumber.from(txReceipt.gasUsed);
    const totalFee = effectiveGasPrice.mul(gasUsed).div(one_gwei);
    const block = await provider.getBlock(txReceipt.blockNumber);
    const minedAt = new Date(block.timestamp * 1000);
  
    return [
      `_Gas Price (GWEI):_ \`${formatBigNumber(effectiveGasPrice, 9, 4)}\``,
      `_Gas Used:_ \` ${formatBigNumber(gasUsed, 0, 0)}\``,
      `_Total Fee (MATIC):_ \`${formatBigNumber(totalFee, 9, 8)}\``,
      `_Mined At (Local):_ \`${format(minedAt.getTime(), 'd MMMM Y HH:mm')}\``,
      `_Mined At Unix:_ \`${minedAt.getTime()}\``,
      `_Submitted At Unix:_ \`${submittedAt.getTime()}\``,
      `_Seconds To Mine:_ \`${(minedAt.getTime() - submittedAt.getTime()) / 1000}\``,
      ``,
      `${txUrl}`
    ];
  }

  export type TempleTaskDiscordEventType = 'Liquidated';
export interface TempleTaskDiscordEvent {
  what: TempleTaskDiscordEventType;
  details: string[];
}
export interface TempleTaskDiscordMetadata {
  title: string;
  events: TempleTaskDiscordEvent[]
  submittedAt: Date;
  txReceipt: ethers.ContractReceipt;
  txUrl: string;
}

/**
 * 
 * Generate markdown for temple tasks discord  
 */

export async function buildTempleTasksDiscordMessage(provider: Provider, chain: Chain, metadata: TempleTaskDiscordMetadata): Promise<DiscordMesage> {
  const { title, submittedAt, txReceipt, txUrl, events } = metadata;

  const content = [
    `**TEMPLE ${title} Event [${chain.name}]**`,
    ...events.map(ev => {
      return (
        `\n_What_: ${ev.what}` +
        `${ev.details.map(d => `\n\t\t\t\t• ${d}`)}`
      );
    }
    ),
    ``,
    ...await txReceiptMarkdown(provider, submittedAt, txReceipt, txUrl),
  ];

  return {
    content: content.join('\n'),
  }
}