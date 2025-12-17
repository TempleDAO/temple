import { TaskContext, TaskResult, taskSuccess, taskSuccessSilent } from "@mountainpath9/overlord-core";
import { createTransactionManager } from "@mountainpath9/overlord-viem";
import { KvPersistedValue } from "@/utils/kv";
import { etherscanTransactionUrl } from "@/utils/etherscan";
import { postDefconNotification } from "@/utils/discord";
import { chainFromId, getSubmissionParams } from "@/config";
import { delayUntilNextCheckTime } from "@/utils/task-checks";
import { getPublicClient, getWalletClient } from "@mountainpath9/overlord-viem";
import { Address, encodeFunctionData, getContract } from "viem";
import * as TempleGoldStaking from "@/abi/ITempleGoldStaking"
import { isMaxGasPriceExceeded } from "@/utils/gas-checks";


export const taskIdPrefix = 'tlgdstaking-a-';

interface Params {
    signerId: string,
    chainId: number,
    contracts: { templeGold: Address, staking: Address },
    lastRunTime: KvPersistedValue<Date>;
    checkPeriodFinish: boolean,
    checkPeriodMs: number,
    lastCheckTime: KvPersistedValue<Date>,
}

export async function stakingDistributeRewards(ctx: TaskContext, params: Params): Promise<TaskResult> {
    const chain = chainFromId(params.chainId);
    const pclient = await getPublicClient(ctx, chain);
    const wclient = await getWalletClient(ctx, chain, params.signerId);
    const transactionManager = await createTransactionManager(ctx, wclient, await getSubmissionParams(ctx, chain.id));

    const staking = getContract({
        address: params.contracts.staking,
        abi: TempleGoldStaking.ABI,
        client: pclient
    });

    // no staker
    const totalSupply = await staking.read.totalSupply();
    if (totalSupply == BigInt(0)) {
        ctx.logger.info('Skipping due to no staker');
        return taskSuccessSilent();
    }

    const now = new Date();
    if (await delayUntilNextCheckTime(params.checkPeriodMs, params.lastCheckTime, now)) {
        ctx.logger.info(`skipping as distribute staking not due`);
        return taskSuccessSilent();
    }

    if (await isMaxGasPriceExceeded(ctx, pclient, params.chainId)) { return taskSuccessSilent(); }

    // check reward period finish
    
    const ts = (await pclient.getBlock()).timestamp;
    if (params.checkPeriodFinish) {
        const rData = await staking.read.getRewardData();
        if (rData.periodFinish > ts) {
            ctx.logger.info('Skipping due to reward period finish not reached');
            return taskSuccessSilent();
        }
    }

    // cooldown
    const lastRewardNotificationTimestamp = await staking.read.lastRewardNotificationTimestamp();
    const rewardDistributionCoolDown = await staking.read.rewardDistributionCoolDown();
    if (rewardDistributionCoolDown + lastRewardNotificationTimestamp > ts) {
        ctx.logger.info('Skipping due to reward notification cooldown');
        return taskSuccessSilent();
    }

    const data = encodeFunctionData({
        abi: TempleGoldStaking.ABI,
        functionName: 'distributeRewards'
    });
    const tx = { data, to: params.contracts.staking };
    const txr = await transactionManager.submitAndWait(tx);

    // last run time
    await params.lastRunTime.set(new Date());

    const message = `_transaction_: <${etherscanTransactionUrl(params.chainId, txr.transactionHash)}>`;
    if (await postDefconNotification('defcon5', message, ctx)) {
        ctx.logger.info(`Staking distribution discord notification sent`);
    }

    return taskSuccess();
}