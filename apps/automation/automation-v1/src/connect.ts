import { AutotaskEvent } from "defender-autotask-utils";
import { KeyValueStoreClient, KeyValueStoreCreateParams } from "defender-kvstore-client";
import { DefenderRelayProvider, DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { AutotaskRelayerParams } from "defender-relay-client/lib/relayer";
import { CommonConfig } from "./config";

export interface AutotaskConnection {
    provider: DefenderRelayProvider,
    signer: DefenderRelaySigner,
    store: KeyValueStoreClient,
}

export const CHAIN_IDS = {
    arbitrum: 42161,
    mumbai: 80001,
    mainnet: 1,
};
export type CHAIN_NAME = keyof typeof CHAIN_IDS;

export async function autotaskConnect(
    event: AutotaskEvent, 
    config: CommonConfig,
): Promise<AutotaskConnection> {
    const autotaskRelayerParams: AutotaskRelayerParams = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        credentials: event.credentials!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        relayerARN: event.relayerARN!,
    };
    const provider = new DefenderRelayProvider(autotaskRelayerParams);
    const signer = new DefenderRelaySigner(
        autotaskRelayerParams, 
        provider, 
        {
            speed: 'fastest',
            validForSeconds: config.TRANSACTION_VALID_FOR_SECS
        }
    );

    if (CHAIN_IDS[config.NETWORK] != await signer.getChainId()) {
        throw new Error(
            `Relayer chain id [${await signer.getChainId()}] does not match ` +
            `expected [${CHAIN_IDS[config.NETWORK]}] for network [${config.NETWORK}]`
        );
    }

    console.log("Relayer Address", await signer.getAddress());

    const kvStoreParams: KeyValueStoreCreateParams = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        credentials: event.credentials!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        kvstoreARN: event.kvstoreARN!,
    };
    const store = new KeyValueStoreClient(kvStoreParams);

    return {
        provider,
        signer,
        store,
    };
}