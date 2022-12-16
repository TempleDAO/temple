import { AutotaskEvent } from 'defender-autotask-utils';
import { AutotaskResult, isFailure } from '../../autotask-result';
import { CommonConfig } from '../../config';
import { autotaskConnect } from '../../connect';
import { pullERC20 } from '../../common/pull-erc20';

const NETWORK = "mainnet";

const COMMON_CONFIG: CommonConfig = {
    TRANSACTION_VALID_FOR_SECS: 900, // 15 mins
    TRANSACTION_SPEED: 'fast',
    TRANSACTION_IS_PRIVATE: false,
};

const CONFIG = {
    MULTISIG_ADDRESS: "0xE97CB3a6A0fb5DA228976F3F2B8c37B6984e7915",
    ST_YCRV_ADDRESS: "0x27B5739e22ad9033bcBf192059122d163b60349D",
    MIN_ST_YCRV_THRESHOLD: 10_000, // Min amount of CRV needed in the multisig before the bot pulls it in
};

export async function handler(event: AutotaskEvent): Promise<AutotaskResult> {
    const connection = await autotaskConnect(event, NETWORK, COMMON_CONFIG);

    const result = await pullERC20(
        connection,
        "st-yCRV",
        CONFIG.ST_YCRV_ADDRESS,
        CONFIG.MULTISIG_ADDRESS,
        CONFIG.MIN_ST_YCRV_THRESHOLD,
        COMMON_CONFIG
    );

    if (isFailure(result)) {
        throw new Error("Automation Failed");
    }
    return result;
}
