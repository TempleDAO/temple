import { AutotaskEvent } from 'defender-autotask-utils';
import { createCommonConfig } from '@/config';
import { AutotaskConnection, autotaskConnect } from '@/connect';
import { AutotaskResult, createdTransaction, isFailure, noop } from '@/autotask-result';
import { IERC20__factory, Sentiment__factory } from '@/typechain';
import { ethers } from 'ethers';
import { sendTransaction } from '@/ethers';

const TRANSACTION_NAME='sentiment-usdc';

const COMMON_CONFIG = createCommonConfig(
    'arbitrum',
    TRANSACTION_NAME,
    0,
    'fastest',
);

const CONFIG = {
    usdc: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    lusdc: '0x0dDB1eA478F8eF0E22C7706D2903a41E94B1299B',
    threshold: ethers.utils.parseUnits("100", 6),
    msig: '0x759bc1678e9d35BdD78C50e4bCF4aCeAf4869A8D',
}

async function run(connection: AutotaskConnection): Promise<AutotaskResult> {
    console.log("Sentiment USDC Running");

    // // To transfer back to the msig:
    // {
    //     const ltoken = IERC20__factory.connect(
    //         CONFIG.lusdc, 
    //         connection.signer
    //     );
    //     const mybalance = await ltoken.balanceOf(await connection.signer.getAddress());
    //     const populatedTx = await ltoken.populateTransaction.transfer(CONFIG.msig, mybalance);
    //     const tx = await sendTransaction(connection, COMMON_CONFIG, populatedTx);
    //     console.log(`Waiting on transaction: ${tx.hash}`);
    //     return createdTransaction(tx.hash);
    // }


    const ltoken = Sentiment__factory.connect(
        CONFIG.lusdc, 
        connection.signer
    );

    const stable = IERC20__factory.connect(
        CONFIG.usdc,
        connection.signer
    );

    const balance = await stable.balanceOf(ltoken.address);
    console.log("Sentiment USDC Balance:", ethers.utils.formatUnits(balance, 6));
    
    const mybalance = await ltoken.balanceOf(await connection.signer.getAddress());
    console.log("My LUSDC Balance:", ethers.utils.formatUnits(mybalance, 6));

    if (balance.lt(CONFIG.threshold) || mybalance.lt(CONFIG.threshold)) {
        return noop();
    }

    let redeemAmount = await ltoken.convertToShares(balance);
    redeemAmount = redeemAmount.mul(999).div(1000);

    redeemAmount = mybalance.lt(redeemAmount) ? mybalance : redeemAmount;
    console.log(
        `Redeeming: [${ethers.utils.formatUnits(redeemAmount, 6)}] LUSDC Shares`
    );

    const populatedTx = await ltoken.populateTransaction.redeem(redeemAmount, CONFIG.msig, await connection.signer.getAddress());
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
