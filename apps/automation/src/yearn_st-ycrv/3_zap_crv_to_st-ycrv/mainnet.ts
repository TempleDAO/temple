import { AutotaskEvent } from 'defender-autotask-utils';
import { BigNumber } from 'ethers';
import { AutotaskResult, createdTransaction, isFailure, noop } from '../../autotask-result';
import { CommonConfig } from '../../config';
import { autotaskConnect, AutotaskConnection } from '../../connect';
import { sendTransaction } from '../../ethers';
import { IERC20__factory, Yearn_YCRV_Zapper__factory } from '../../typechain';

const NETWORK = "mainnet";

const COMMON_CONFIG: CommonConfig = {
    TRANSACTION_VALID_FOR_SECS: 900, // 15 mins
    TRANSACTION_SPEED: 'fast',
    TRANSACTION_IS_PRIVATE: true,
    TRANSACTION_SLIPPAGE_BPS: 50, // 0.5% 
};

const CONFIG = {
    MULTISIG_ADDRESS: "0xE97CB3a6A0fb5DA228976F3F2B8c37B6984e7915",
    CRV_ADDRESS: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    ST_YCRV_ADDRESS: "0x27B5739e22ad9033bcBf192059122d163b60349D",
    YEARN_YCRV_ZAPPER: "0x27B5739e22ad9033bcBf192059122d163b60349D",

}

const applySlippage = function(amount: BigNumber): BigNumber {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return amount.mul(10_000 - COMMON_CONFIG.TRANSACTION_SLIPPAGE_BPS!).div(10_000);
}

const run = async (
    connection: AutotaskConnection,
): Promise<AutotaskResult> => {
    const relayerAddress = connection.signer.getAddress();
    const crv = IERC20__factory.connect(CONFIG.CRV_ADDRESS, connection.signer);
    const st_y_crv = IERC20__factory.connect(CONFIG.ST_YCRV_ADDRESS, connection.signer);
    const zapper = Yearn_YCRV_Zapper__factory.connect(CONFIG.YEARN_YCRV_ZAPPER, connection.signer);

    const relayerCrvBal = await crv.balanceOf(relayerAddress);
    console.log(`Relayer CRV balance: [${relayerCrvBal}]`);

    if (relayerCrvBal.isZero()) {
        console.log("No CRV balance");
        return noop();
    }

    const expectedAmountOut = await zapper.calc_expected_out(CONFIG.CRV_ADDRESS, CONFIG.ST_YCRV_ADDRESS, relayerCrvBal);
    console.log(`Zapping [${relayerCrvBal}] CRV ==> [${expectedAmountOut}] st-yCRV to multisig [${CONFIG.MULTISIG_ADDRESS}]`);

    const minExpectedAmountOut = applySlippage(expectedAmountOut);
    console.log(`Min amount of st-yCRV after [${COMMON_CONFIG.TRANSACTION_SLIPPAGE_BPS}] bps slippage = [${minExpectedAmountOut}]`);

    const multisigStyCrvBefore = await st_y_crv.balanceOf(CONFIG.MULTISIG_ADDRESS);
    console.log(`Multisig balance of st-yCRV before tx = [${multisigStyCrvBefore}]`);

    const populatedTx = await zapper.populateTransaction['zap(address,address,uint256,uint256,address)'](
        CONFIG.CRV_ADDRESS,
        CONFIG.ST_YCRV_ADDRESS,
        relayerCrvBal,
        minExpectedAmountOut,
        CONFIG.MULTISIG_ADDRESS
    );
    const tx = await sendTransaction(connection.signer, COMMON_CONFIG, populatedTx);
    console.log(`Waiting on transaction: ${tx.hash}`);
    return createdTransaction(tx.hash);
}

export async function handler(event: AutotaskEvent): Promise<AutotaskResult> {
    const connection = await autotaskConnect(event, NETWORK, COMMON_CONFIG);
    const result = await run(connection);
    if (isFailure(result)) {
        throw new Error("RAMOS Operation Failed");
    }
    return result;
}
