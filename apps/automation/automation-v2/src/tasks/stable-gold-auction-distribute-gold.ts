import { KvPersistedValue } from "@/utils/kv";
import { TaskContext, TaskResult,
  taskSuccess, taskSuccessSilent } from "@mountainpath9/overlord-core";
import { createTransactionManager, getPublicClient, getWalletClient } from "@mountainpath9/overlord-viem";
import { chainFromId, getSubmissionParams } from "@/config";
import { postDefconNotification } from "@/utils/discord";
import { etherscanTransactionUrl } from "@/utils/etherscan";
import { getMsSinceLastDistribution } from "@/utils/distribute";
import { Address, encodeFunctionData, getContract } from "viem";
import * as TempleGold from "@/abi/ITempleGold";
import { isMaxGasPriceExceeded } from "@/utils/gas-checks";

export const taskIdPrefix = 'tlgddaigoldauction-distribute-gold-a-';

export interface Params {
    signerId: string,
    chainId: number,
    contracts: { auction: Address, templeGold: Address, staking: Address },
    lastRunTime: KvPersistedValue<Date>;
    checkPeriodMs: number,
    lastCheckTime: KvPersistedValue<Date>,
}

export async function distributeGold(ctx: TaskContext, params: Params): Promise<TaskResult> {
  const chain = chainFromId(params.chainId);
  const pclient = await getPublicClient(ctx, chain);
  const wclient = await getWalletClient(ctx, chain, params.signerId);
  const transactionManager = await createTransactionManager(ctx, wclient, await getSubmissionParams(ctx, chain.id));
  
  const templeGold = getContract({
    address: params.contracts.templeGold,
    abi: TempleGold.ABI,
    client: pclient
  });

  if (await isMaxGasPriceExceeded(ctx, pclient, params.chainId)) {  return taskSuccessSilent(); }

  // check last distribution
  const now = new Date();
  const ms = await getMsSinceLastDistribution(params.lastRunTime, now);
  if (ms && ms < params.checkPeriodMs) {
    ctx.logger.info(`skipping as checked recently`);
    return taskSuccessSilent();
  }
  
  ctx.logger.info(`Gold amount before ${await templeGold.read.balanceOf([params.contracts.auction])}`);
  const mintAmount = await templeGold.read.getMintAmount();
  ctx.logger.info(`Mint amount: ${mintAmount}`);

  const data = encodeFunctionData({
    abi: TempleGold.ABI,
    functionName: 'mint'
  });
  const tx = { data, to: params.contracts.templeGold };
  const txr = await transactionManager.submitAndWait(tx);
  ctx.logger.info(`Mint amount: ${await templeGold.read.getMintAmount()}`);
  ctx.logger.info(`Gold auction tgld amount after ${await templeGold.read.balanceOf([params.contracts.auction])}`);

  await params.lastRunTime.set(now);

  const message = `_transaction_: <${etherscanTransactionUrl(params.chainId, txr.transactionHash)}>`;
  if (await postDefconNotification('defcon5', message, ctx)) {
    ctx.logger.info(`Stable Gold distribution gold discord notification sent`);
  }

  return taskSuccess();
}