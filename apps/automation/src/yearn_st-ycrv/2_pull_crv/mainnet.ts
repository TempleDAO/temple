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
    CRV_ADDRESS: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    MIN_CRV_THRESHOLD: 10_000, // Min amount of CRV needed in the multisig before the bot pulls it in
}

export async function handler(event: AutotaskEvent): Promise<AutotaskResult> {
    const connection = await autotaskConnect(event, NETWORK, COMMON_CONFIG);

    const result = await pullERC20(
        connection,
        "CRV",
        CONFIG.CRV_ADDRESS,
        CONFIG.MULTISIG_ADDRESS,
        CONFIG.MIN_CRV_THRESHOLD,
        COMMON_CONFIG
    );

    if (isFailure(result)) {
        throw new Error("Automation Failed");
    }
    return result;
}
