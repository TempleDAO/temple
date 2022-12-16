import { ethers } from "ethers";
import { AutotaskResult, createdTransaction, noop } from "../autotask-result";
import { CommonConfig } from "../config";
import { AutotaskConnection } from "../connect";
import { sendTransaction } from "../ethers";
import { IERC20__factory } from "../typechain";

export const pullERC20 = async (
    connection: AutotaskConnection,
    tokenName: string,
    tokenAddress: string,
    fromAddress: string,
    minThreashold: number,
    config: CommonConfig,
): Promise<AutotaskResult> => {
    const relayerAddress = connection.signer.getAddress();
    const token = IERC20__factory.connect(tokenAddress, connection.signer);
    const fromTokenBal = await token.balanceOf(fromAddress);
    console.log(`fromAddress=[${fromAddress}] tokenAddress=[${tokenName}] balance=[${ethers.utils.formatEther(fromTokenBal)}]`);
    
    // Pull CRV to our relayer
    if (fromTokenBal.lt(minThreashold)) {
        console.log(`fromAddress token balance doesn't meet the min threshold ${minThreashold}`);
        return noop();
    }
    
    console.log(`Pulling [${fromTokenBal}] tokens into relayer`);
    const populatedTx = await token.populateTransaction.transferFrom(
        fromAddress, 
        relayerAddress,
        fromTokenBal,
    );

    const tx = await sendTransaction(connection.signer, config, populatedTx);
    console.log(`Waiting on transaction: ${tx.hash}`);
    return createdTransaction(tx.hash);
}