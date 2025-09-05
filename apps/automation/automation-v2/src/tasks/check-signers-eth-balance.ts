import { checkSignerBalance } from "./check-signer-balance";
import { BigRational } from "@mountainpath9/big-rational";
import { KvPersistedValue } from "@/utils/kv";
import { TaskContext, TaskResult, taskSuccessSilent } from "@mountainpath9/overlord-core";


export const taskIdPrefix = 'tlgdchecksignersethbalance-';

export interface Params {
    signersWithPrevBalance: Array<SignerWithPrevBalance>,
    chainId: number,
    lastRunTime: KvPersistedValue<Date>;
    minBalance: BigRational,
    checkPeriodMs: number,
    lastCheckTime: KvPersistedValue<Date>,
}

export interface SignerWithPrevBalance {
    signer: string,
    prevBalance: KvPersistedValue<BigRational>,
}

export async function checkSignersEthBalance(ctx: TaskContext, params: Params): Promise<TaskResult> {
    const signers = params.signersWithPrevBalance;
    for(let _signer of signers) {
        await checkSignerBalance(
            ctx, {
            signerId: _signer.signer,
            chainId: params.chainId,
            minBalance: params.minBalance,
            prevBalance: _signer.prevBalance
        });
    }

    return taskSuccessSilent();
}