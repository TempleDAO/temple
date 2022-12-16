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
    HOTWALLET_ADDRESS: "Lux's HW",
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

    const relayerStyCrvBal = await st_y_crv.balanceOf(relayerAddress);
    console.log(`Relayer st-yCRV balance: [${relayerStyCrvBal}]`);

    if (relayerStyCrvBal.isZero()) {
        console.log("No st-yCRV balance");
        return noop();
    }

    const expectedAmountOut = await zapper.calc_expected_out(CONFIG.ST_YCRV_ADDRESS, CONFIG.CRV_ADDRESS, relayerStyCrvBal);
    console.log(`Zapping [${relayerStyCrvBal}] st-yCRV ==> [${expectedAmountOut}] st-yCRV to address [${CONFIG.HOTWALLET_ADDRESS}]`);

    const minExpectedAmountOut = applySlippage(expectedAmountOut);
    console.log(`Min amount of CRV after [${COMMON_CONFIG.TRANSACTION_SLIPPAGE_BPS}] bps slippage = [${minExpectedAmountOut}]`);

    const toAddressCrvBefore = await crv.balanceOf(CONFIG.HOTWALLET_ADDRESS);
    console.log(`Hot Wallet balance of CRV before tx = [${toAddressCrvBefore}]`);

    const populatedTx = await zapper.populateTransaction['zap(address,address,uint256,uint256,address)'](
        CONFIG.ST_YCRV_ADDRESS,
        CONFIG.CRV_ADDRESS,
        relayerStyCrvBal,
        minExpectedAmountOut,
        CONFIG.HOTWALLET_ADDRESS,
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
