import { AutotaskEvent } from 'defender-autotask-utils';
import { AutotaskResult, createdTransaction, isFailure, noop } from '../../autotask-result';
import { CommonConfig } from '../../config';
import { BigNumber } from 'ethers';
import { autotaskConnect, AutotaskConnection } from '../../connect';
import { sendTransaction } from '../../ethers';
import { 
    Yearn_RewardsContract__factory, 
    Yearn_Splitter, 
    Yearn_Splitter__factory, 
    Yearn_Strategy__factory
} from '../../typechain';
import { DefenderRelayProvider } from "defender-relay-client/lib/ethers";

const NETWORK = "mainnet";

const COMMON_CONFIG: CommonConfig = {
    TRANSACTION_VALID_FOR_SECS: 900, // 15 mins
    TRANSACTION_SPEED: 'fast', // Run 'fast' as private transactions need a bit more gas to get picked up
    TRANSACTION_IS_PRIVATE: true,
};

const ONE_WEEK = 86400 * 7;

const CONFIG = {
    SPLITTER_ADDRESS: "0x77Ff318a33cf832671D2F9E0393cd1f854Fe8111",
    STALENESS_PERIOD: ONE_WEEK / 2,
}

const isLastUpdateTimeStale = async (provider: DefenderRelayProvider, splitter: Yearn_Splitter, currentBlockTime: BigNumber) => {
    const strategyAddr = await splitter.strategy();
    const strategy = Yearn_Strategy__factory.connect(strategyAddr, provider);
    const rewardsContractAddr = await strategy.rewardsContract();
    const rewardsContract = Yearn_RewardsContract__factory.connect(rewardsContractAddr, provider);
    const lastUpdateTime = await rewardsContract.lastUpdateTime();
    const isStale = lastUpdateTime > currentBlockTime.add(CONFIG.STALENESS_PERIOD);
    console.log(
        `Last strategy rewards update time = [${lastUpdateTime.toString()}] ` +
        `currentBlockTime=[${currentBlockTime.toString()}] stalenessPeriod=[${CONFIG.STALENESS_PERIOD}] ` + 
        `isLastUpdateTimeStale=[${isStale}]`
    );
    return isStale;
}

export const run = async (connection: AutotaskConnection): Promise<AutotaskResult> => {
    const splitter = Yearn_Splitter__factory.connect(CONFIG.SPLITTER_ADDRESS, connection.signer);
    const currentBlockTime = BigNumber.from((await splitter.provider.getBlock("latest")).timestamp);

    const _isLastUpdateTimeStale = await isLastUpdateTimeStale(connection.provider, splitter, currentBlockTime)
    if (!_isLastUpdateTimeStale) {
        return noop();
    }

    console.log("Executing split");
    const populatedTx = await splitter.populateTransaction.split();
    const tx = await sendTransaction(connection.signer, COMMON_CONFIG, populatedTx);
    console.log(`Waiting on transaction: ${tx.hash}`);
    return createdTransaction(tx.hash);
}

export async function handler(event: AutotaskEvent): Promise<AutotaskResult> {
    const connection = await autotaskConnect(event, NETWORK, COMMON_CONFIG);
    const result = await run(connection);
    if (isFailure(result)) {
        throw new Error("Automation Failed");
    }
    return result;
}
