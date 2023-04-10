import { EthReceipt } from "defender-autotask-utils";
import { IKeyValueStoreClient } from "defender-kvstore-client/lib/types";
import { BigNumber, ethers } from "ethers";
import { CommonConfig } from "./config";
import { getLastTxTimeKey } from "./ethers";
import { AutotaskConnection } from "./connect";

export async function popStore(store: IKeyValueStoreClient, key: string): Promise<string | undefined> {
    const value = await store.get(key);
    await store.del(key);
    return value;
}

// Format numbers with a certain number of decimal places, to locale
export const formatNumber = (number: number, displayDecimals: number): string => {
    const stringified = number.toString();
    const decimalPlaces = stringified.includes('.')
      ? stringified.split('.')[1].length
      : 0;
  
    return decimalPlaces >= displayDecimals
      ? number.toLocaleString('en-US', {
          minimumFractionDigits: displayDecimals,
        })
      : number.toLocaleString('en-US');
  };

// String representation of a BigNumber, which is represented with a certain number of decimals
export const formatBigNumber = (bn: BigNumber, dnDecimals: number, displayDecimals: number): string => {
    return formatNumber(Number(ethers.utils.formatUnits(bn, dnDecimals)), displayDecimals);
};

export interface EventConditionSummary {
    signature: string;
    params: {
        [key: string]: unknown;
    };
};

export interface TransactionReceipt extends EthReceipt {
    effectiveGasPrice: string,
    gasUsed: string,
};

export const one_gwei = BigNumber.from("1000000000");

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Keep trying to run `fn` until it returns true, sleeping in between, and timeout after 
// TOTAL_TIMEOUT_SECS
export const tryUntilTimeout = async (
    startUnixMilliSecs: number,
    config: CommonConfig,
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
            console.log(`Timeout: TOTAL_TIMEOUT_SECS [${config.TOTAL_TIMEOUT_SECS}] was reached`);
            return false;
        }

        // Sleep for WAIT_SLEEP_SECS then try again.
        await sleep(cooldownSleepMilliSecs);
    }
}

// A previously created transaction from a prior autotask may still be waiting to be mined (as it's created async)
// Continue to sleep until either it completes. This would be cleared by: An OZ Sentinal firing on an event, triggering an
// autotask (eg transfer-staked-glp-alert) that clears the store)
// or after the last transaction time + cooldown.
export const waitForLastTransactionToFinish = (
    connection: AutotaskConnection,
    config: CommonConfig,
    startUnixMilliSecs: number
): Promise<boolean> => {
    const transactionDeadlineMs = 1000 * config.TRANSACTION_VALID_FOR_SECS;

    return tryUntilTimeout(startUnixMilliSecs, config, async () => {
        const lastTxTimeStr = await connection.store.get(getLastTxTimeKey(config.NETWORK, config.TRANSACTION_NAME));

        if (!lastTxTimeStr) {
            console.log(`No in-flight transaction found. Running...`);
            return true;
        }

        const lastTxDeadline = parseInt(lastTxTimeStr) + transactionDeadlineMs;
        const currentTimeMs = new Date().getTime();

        if (currentTimeMs > lastTxDeadline) {
            // The transaction is either complete or the deadline has passed.
            console.log(
                `Prior transaction found but tx deadline [${transactionDeadlineMs}] has passed. ` +
                `Last transaction time [${lastTxTimeStr}], current time [${currentTimeMs}]. Running...`
            );
            return true;
        }

        console.log(
            `Previous transaction may still be waiting to be mined. Current time=[${currentTimeMs}], ` +
            `prevoius transaction deadline=[${lastTxDeadline}], remaining ms = [${lastTxDeadline-currentTimeMs}]. ` +
            `Sleeping...`
        );
        return false;
    });
}

export function bpsToFraction(bps: number): number {
    // eg 100 -> 0.01 (1%)
    return bps / 10_000;
}