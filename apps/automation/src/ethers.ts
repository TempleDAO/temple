import { DefenderTransactionRequest } from "defender-relay-client/lib/ethers";
import { BigNumber, ethers } from "ethers";
import { CommonConfig } from "./config";
import { AutotaskConnection, CHAIN_NAME } from "./connect";

const LAST_TX_TIME_KEY = 'last-tx-time';
export const getLastTxTimeKey = (network: CHAIN_NAME, txName: string) => {
    return `${network}.${txName}.${LAST_TX_TIME_KEY}`;
}

export async function sendTransaction(
    connection: AutotaskConnection,
    config: CommonConfig,
    populatedTx: ethers.PopulatedTransaction,
): Promise<ethers.providers.TransactionResponse> {
    // Use the `sendTransaction()` call provided by Defender, such that
    // we can use isPrivate=true
    const defenderPopulatedTx: DefenderTransactionRequest = {
        ...populatedTx,
        isPrivate: config.TRANSACTION_IS_PRIVATE,
        speed: config.TRANSACTION_SPEED,
    };
    
    const response = connection.signer.sendTransaction(defenderPopulatedTx);

    // Set the time the most recent transaction was successfully placed, in ms
    await connection.store.put(
        getLastTxTimeKey(config.NETWORK, config.TRANSACTION_NAME),
        new Date().getTime().toString()
    );

    return response;
}

export async function getBlockTimestamp(connection: AutotaskConnection): Promise<BigNumber> {
    const latestBlock = await connection.provider.getBlock("latest");
    return BigNumber.from(latestBlock.timestamp);
}
