import { AutotaskEvent } from 'defender-autotask-utils';
import { CommonConfig } from '@/config';
import { AutotaskConnection, autotaskConnect } from '@/connect';
import { AutotaskResult, createdTransaction, isFailure, noop, timeout } from '@/autotask-result';
import { IERC20__factory, TempleStableAMMRouter__factory } from '@/typechain';
import { ethers } from 'ethers';
import { getBlockTimestamp, sendTransaction } from '@/ethers';
import { waitForLastTransactionToFinish } from '@/utils';

export const TRANSACTION_NAME='temple-buyback';

const COMMON_CONFIG: CommonConfig = {
    NETWORK: 'mainnet',
    TRANSACTION_NAME: TRANSACTION_NAME,
    TRANSACTION_VALID_FOR_SECS: 290, // Just under 5 mins
    TRANSACTION_SPEED: 'fastest',
    TRANSACTION_IS_PRIVATE: true,
    TRANSACTION_SLIPPAGE_BPS: 10, // 0.1%
    WAIT_SLEEP_SECS: 15,
    TOTAL_TIMEOUT_SECS: 290, 
};

const CONFIG = {
    stableSellAmount: 15_000,
    buyThresholdPrice: 10100, // $1.01
    temple: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    frax: '0x853d955acef822db058eb8505911ed77f175b99e',
    ammRouter: '0x98257c876ace5009e7b97843f8c71b3ae795c71e',
    templeFraxPair: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    msig: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
}

const ONE_ETH = ethers.utils.parseEther("1");

async function run(connection: AutotaskConnection): Promise<AutotaskResult> {
    const startUnixMilliSecs = (new Date()).getTime();

    if (!await waitForLastTransactionToFinish(connection, COMMON_CONFIG, startUnixMilliSecs)) {
        return timeout("previous tx running");
    }

    console.log("Temple Buyback Running");

    const frax = IERC20__factory.connect(
        CONFIG.frax,
        connection.signer
    );
    const router = TempleStableAMMRouter__factory.connect(
        CONFIG.ammRouter,
        connection.signer
    );

    const buyThresholdPrice = ONE_ETH.mul(CONFIG.buyThresholdPrice).div(10_000);
    console.log(`Min Price to buyback: ${ethers.utils.formatEther(buyThresholdPrice)}`);
    console.log("Checking Current Price:");

    const stableBalance = await frax.balanceOf(await connection.signer.getAddress());
    console.log(`FRAX balance: ${ethers.utils.formatEther(stableBalance)}`);
    let stableSellAmount = ONE_ETH.mul(CONFIG.stableSellAmount);
    console.log(`Max FRAX sell amount: ${ethers.utils.formatEther(stableSellAmount)}`);

    stableSellAmount = stableBalance.lt(stableSellAmount) ? stableBalance : stableSellAmount;
    if (stableSellAmount.isZero()) {
        console.log("No stables to sell");
        return noop();
    }

    const templeBuyAmount = await router.swapExactStableForTempleQuote(CONFIG.templeFraxPair, stableSellAmount);
    console.log(`Quote to sell ${ethers.utils.formatEther(stableSellAmount)} FRAX ==> ${ethers.utils.formatEther(templeBuyAmount)} TEMPLE`);

    console.log(`0% slippage price: ${ethers.utils.formatEther(stableSellAmount.mul(ONE_ETH).div(templeBuyAmount))}`);

    const minTempleBuyAmount = templeBuyAmount.mul(10_000 - COMMON_CONFIG.TRANSACTION_SLIPPAGE_BPS).div(10_000);
    const minExecutionPrice = stableSellAmount.mul(ONE_ETH).div(minTempleBuyAmount);
    console.log(`Expected min execution price with ${COMMON_CONFIG.TRANSACTION_SLIPPAGE_BPS} BPS slippage: ${ethers.utils.formatEther(minExecutionPrice)}`);

    if (minExecutionPrice.gt(buyThresholdPrice)) {
        console.log("Price too high");
        return noop();
    }

    const deadline = (await getBlockTimestamp(connection)).add(COMMON_CONFIG.TRANSACTION_VALID_FOR_SECS);

    console.log("Placing order for:");
    console.log(`FRAX Sell: ${ethers.utils.formatEther(stableSellAmount)}`);
    console.log(`Min Temple Buy: ${ethers.utils.formatEther(minTempleBuyAmount)}`);
    console.log(`Min Execution Price: ${ethers.utils.formatEther(minExecutionPrice)}`);
    console.log(`Deadline: ${deadline.toString()}`);
    console.log(`To: ${CONFIG.msig}`);

    const populatedTx = await router.populateTransaction.swapExactStableForTemple(stableSellAmount, minTempleBuyAmount, frax.address, CONFIG.msig, deadline);
    const tx = await sendTransaction(connection, COMMON_CONFIG, populatedTx);
    console.log(`Waiting on transaction: ${tx.hash}`);
    return createdTransaction(tx.hash);
}

export async function handler(event: AutotaskEvent): Promise<AutotaskResult> {
    const connection = await autotaskConnect(event, COMMON_CONFIG);
    const result = await run(connection);
    if (isFailure(result)) {
        console.log(result);
        throw new Error(TRANSACTION_NAME);
    }
    return result;
}
