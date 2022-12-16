import { Speed } from "defender-relay-client/lib/relayer";

export interface CommonConfig {
    TRANSACTION_VALID_FOR_SECS: number, // The number of seconds a transaction is valid for until it fails.
    TRANSACTION_SPEED: Speed, // The speed at which to mine transactions.
    TRANSACTION_IS_PRIVATE: boolean, // If true, use flashbot protect to hide - note transactions will take longer to mine and fail after 6 mins. Set the 
    TRANSACTION_SLIPPAGE_BPS?: number, // 50 == 0.5%
}
