import { chainFromId, TX_SUBMISSION_PARAMS } from "@/config";
import { BigRational } from "@mountainpath9/big-rational";
import { etherscanTransactionUrl } from "@/utils/etherscan";
import { postDefconNotification } from "@/utils/discord";
import { KvPersistedValue } from "@/utils/kv";
import { TaskContext, TaskResult, taskSuccess, taskSuccessSilent } from "@mountainpath9/overlord-core";
import { createTransactionManager, getPublicClient, getWalletClient } from "@mountainpath9/overlord-viem";
import { delayUntilNextCheckTime } from "@/utils/task-checks";
import { Address, encodeFunctionData, getContract } from "viem";
import * as StableGoldAuction from "@/abi/IStableGoldAuction";


export const taskIdPrefix = 'tlgddaigoldauction-a-';

export interface Params {
    signerId: string,
    chainId: number,
    contracts: { stableGoldAuction: Address },
    lastRunTime: KvPersistedValue<Date>,
    maxGasPrice: BigRational,
    checkPeriodMs: number,
    lastCheckTime: KvPersistedValue<Date>,
}

export async function startAuction(ctx: TaskContext, params: Params): Promise<TaskResult> {
    const chain = chainFromId(params.chainId);
    const pclient = await getPublicClient(ctx, chain);
    const wclient = await getWalletClient(ctx, chain, params.signerId);
    const transactionManager = await createTransactionManager(ctx, wclient, {...TX_SUBMISSION_PARAMS});
    const stableGoldAuction = getContract({
        abi: StableGoldAuction.ABI,
        address: params.contracts.stableGoldAuction,
        client: pclient
    });

    const now = new Date();
    if (await delayUntilNextCheckTime(params.checkPeriodMs, params.lastCheckTime, now)) {
        ctx.logger.info(`skipping as start auction not due`);
        return taskSuccessSilent();
    }

    const currentEpoch = await stableGoldAuction.read.currentEpoch();
    ctx.logger.info(`Current epoch: ${currentEpoch}`);

    const estimate = await pclient.estimateFeesPerGas();
    const gasPrice = BigRational.fromBigIntWithDecimals(estimate.maxFeePerGas || 0n, 9n);
    if (gasPrice.gt(params.maxGasPrice)) {
      ctx.logger.info(`skipping due to high gas price (${gasPrice.toDecimalString(0)} > (${params.maxGasPrice.toDecimalString(0)}`);
      return taskSuccessSilent();
    }

    // checks
    if (currentEpoch != BigInt(0)) {
        const prevAuctionInfo = await stableGoldAuction.read.getEpochInfo([currentEpoch]);
        const config = await stableGoldAuction.read.getAuctionConfig();
        const ts = (await pclient.getBlock()).timestamp;
        const auctionsTimeDiff = BigInt(config.auctionsTimeDiff);
        if (prevAuctionInfo.endTime + auctionsTimeDiff > ts) {
            // cannot start auction
            ctx.logger.info('Skipping due to auctions time difference not reached');
            return taskSuccessSilent();
        }
        
        const totalGoldAmount = await stableGoldAuction.read.nextAuctionGoldAmount();
        if (totalGoldAmount < config.auctionMinimumDistributedGold) {
            // low distributed temple gold
            ctx.logger.info('Skipping due to low distributed Temple Gold');
            return taskSuccessSilent();
        }
    }
    const data = encodeFunctionData({
        abi: StableGoldAuction.ABI,
        functionName: 'startAuction'
    });
    const tx = { data, to: params.contracts.stableGoldAuction };
    const txr = await transactionManager.submitAndWait(tx);

    await params.lastRunTime.set(now);
    
    const message = `_transaction_: <${etherscanTransactionUrl(params.chainId, txr.transactionHash)}>`;
    if (await postDefconNotification('defcon5', message, ctx)) {
        ctx.logger.info(`StableGold auction start discord notification sent`);
    }
    ctx.logger.info(`Current epoch, after auction start: ${await stableGoldAuction.read.currentEpoch()}`);

    return taskSuccess();
}