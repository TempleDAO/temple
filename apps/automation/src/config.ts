import { Speed } from "defender-relay-client/lib/relayer";
import { CHAIN_IDS } from "./connect";

export interface CommonConfig {
    NETWORK: keyof typeof CHAIN_IDS, // The string representation of the expected network
    TRANSACTION_NAME: string, // A human readable name of the transaction. No spaces.
    TRANSACTION_VALID_FOR_SECS: number, // The number of seconds a transaction is valid for until it fails.
    TRANSACTION_SPEED: Speed, // The speed at which to mine transactions.
    TRANSACTION_IS_PRIVATE: boolean, // If true, use flashbot protect to hide - note transactions will take longer to mine and fail after 6 mins. Set the 
    TRANSACTION_SLIPPAGE_BPS: number, // 50 == 0.5%
    WAIT_SLEEP_SECS: number, // Number of seconds to sleep between retries to check when waiting for conditions to be met.
    TOTAL_TIMEOUT_SECS: number, // The total number of seconds the bot will wait for conditions to be met. Note the OZ autotask will fail noisily after 300 secs, so suggest failing slightly before that.
}

export function createCommonConfig(
    network: keyof typeof CHAIN_IDS, 
    transactionName: string, 
    transactionValidForSecs?: number,
    transactionSpeed?: Speed,
    transactionIsPrivate?: boolean,
    transactionSlippageBps?: number,
    waitSleepSecs?: number,
    totalTimeoutSecs?: number,
): CommonConfig {
    return {
        NETWORK: network,
        TRANSACTION_NAME: transactionName,
        TRANSACTION_VALID_FOR_SECS: transactionValidForSecs || 0,
        TRANSACTION_SPEED: transactionSpeed || 'average',
        TRANSACTION_IS_PRIVATE: transactionIsPrivate || false,
        TRANSACTION_SLIPPAGE_BPS: transactionSlippageBps || 0,
        WAIT_SLEEP_SECS: waitSleepSecs || 0,
        TOTAL_TIMEOUT_SECS: totalTimeoutSecs || 0,
    }
};
