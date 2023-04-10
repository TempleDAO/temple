import { EventConditionSummary, TransactionReceipt, formatBigNumber, one_gwei } from '@/utils';
import {
    BlockTriggerEvent,
    SentinelConditionResponse,
    SentinelConditionMatch,
    SentinelTriggerEvent,
    AutotaskEvent,
    SentinelConditionRequest,
} from 'defender-autotask-utils';
import { BigNumber } from 'ethers';
import { CommonConfig, createCommonConfig } from '@/config';
import { AutotaskConnection, autotaskConnect } from '@/connect';
import { popStore } from '@/utils';
import { getLastTxTimeKey } from '@/ethers';
import { TRANSACTION_NAME } from './buyback';

const COMMON_CONFIG = createCommonConfig(
    'mainnet',
    TRANSACTION_NAME,
);

export async function getAlertResponse(
    connection: AutotaskConnection,
    COMMON_CONFIG: CommonConfig,
    events: SentinelTriggerEvent[],
): Promise<SentinelConditionResponse> {
    // Pop the latest transaction time if it exists
    const lastTxTimeStr = await popStore(
        connection.store, 
        getLastTxTimeKey(COMMON_CONFIG.NETWORK, COMMON_CONFIG.TRANSACTION_NAME)
    );
    const lastTxTimeSecs = !lastTxTimeStr ? 0 : parseInt(lastTxTimeStr) / 1000;

    const matches: SentinelConditionMatch[] = [];
    for (const event of events) {
        const blockEvent = event as BlockTriggerEvent;
        const transactionReceipt = blockEvent.transaction as TransactionReceipt;
        
        const effectiveGasPrice = BigNumber.from(transactionReceipt.effectiveGasPrice); // In wei
        const gasUsed = BigNumber.from(transactionReceipt.gasUsed); 
        const totalFee = effectiveGasPrice.mul(gasUsed).div(one_gwei);

        const title = "Temple Buyback";
        let receiver: string = " ";
        let fraxAmount: string = " ";
        let templeAmount: string = " ";

        for (const reason of blockEvent.matchReasons) {
            const eventReason = reason as EventConditionSummary;
            console.log("event signature:", eventReason.signature);
            console.log("event params:", eventReason.params);

            receiver = eventReason.params.to as string;
            fraxAmount = formatBigNumber(eventReason.params.amount1In as BigNumber, 18, 4);
            templeAmount = formatBigNumber(eventReason.params.amount0Out as BigNumber, 18, 4);
        }

        const match: SentinelConditionMatch = {
            hash: event.hash,
            metadata: {
                gasPrice: formatBigNumber(effectiveGasPrice, 9, 4), // Display in GWEI
                gasUsed: formatBigNumber(gasUsed, 0, 0),
                totalFee: formatBigNumber(totalFee, 9, 8), // Display in ETH to 8 dp
                minedUnixTimestamp: blockEvent.timestamp.toString(),

                title: title,

                submittedUnixTimestamp: lastTxTimeSecs > 0 ? lastTxTimeSecs.toString() : "UNKNOWN",
                secondsToMine: lastTxTimeSecs > 0 ? (Math.round(1000 * (blockEvent.timestamp - lastTxTimeSecs)) / 1000).toString() : "UNKNOWN",

                source: blockEvent.matchedAddresses[0],
                receiver: receiver,
                fraxAmount: fraxAmount,
                templeAmount: templeAmount,
            }
        };
        console.log("Match:", match);
        matches.push(match);
    }

    return {
        matches: matches,
    };
}


export async function handler(event: AutotaskEvent): Promise<SentinelConditionResponse> {
    const connection = await autotaskConnect(event, COMMON_CONFIG);
    const conditionRequest = event.request!.body as SentinelConditionRequest;
    const events = conditionRequest.events;
    return await getAlertResponse(connection, COMMON_CONFIG, events);
}
