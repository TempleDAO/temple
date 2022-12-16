import { DefenderRelaySigner, DefenderTransactionRequest } from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { CommonConfig } from "./config";
// import { getLastTxTimeKey, getPreviousSpotPriceKey, poolAssets, RamosOperation } from "../utils";
// import { MaxRebalanceAmounts, PoolBalances, RamosApi } from "./api";
// import { IKeyValueStoreClient } from "defender-kvstore-client/lib/types";

export async function sendTransaction(
    signer: DefenderRelaySigner, 
    config: CommonConfig,
    populatedTx: ethers.PopulatedTransaction
): Promise<ethers.providers.TransactionResponse> {
    // Use the `sendTransaction()` call provided by Defender, such that
    // we can use isPrivate=true
    const defenderPopulatedTx: DefenderTransactionRequest = {
        ...populatedTx,
        isPrivate: config.TRANSACTION_IS_PRIVATE,
        speed: config.TRANSACTION_SPEED,
    };
    
    const response = signer.sendTransaction(defenderPopulatedTx);

    // Set the time the most recent transaction was successfully placed, in ms
    // await this.store.put(getLastTxTimeKey(this.network), new Date().getTime().toString());

    return response;
}