import { chainFromId } from "@/config";
import { postDefconNotification } from "@/utils/discord";
import { KvPersistedValue } from "@/utils/kv";
import { BigRational } from "@mountainpath9/big-rational";
import { TaskContext, TaskResult, taskSuccessSilent } from "@mountainpath9/overlord-core";
import { getPublicClient, getWalletClient } from "@mountainpath9/overlord-viem";

interface Params {
  signerId: string,
  chainId: number,
  minBalance: BigRational,
  prevBalance: KvPersistedValue<BigRational>,
}

/**
 * Monitor a wallet balance, and send discord messages when the balance drops too low, and when
 * it becomes good again.
 **/
export async function checkSignerBalance(ctx: TaskContext, params: Params): Promise<TaskResult> {
  const chain = chainFromId(params.chainId);
  const pclient = await getPublicClient(ctx, chain);
  const wclient = await getWalletClient(ctx, chain, params.signerId);
  const [signerAddress] = await wclient.getAddresses(); 
  const balance = BigRational.fromBigIntWithDecimals(
    await pclient.getBalance({address: signerAddress}),
    18n
  );
  const prevBalance = await params.prevBalance.get();

  ctx.logger.info(`signer is ${params.signerId} (${signerAddress})`);
  ctx.logger.info(`minBalance = ${params.minBalance.toDecimalString(4)}`);
  ctx.logger.info(`balance = ${balance.toDecimalString(4)}`);
  ctx.logger.info(`prevBalance = ${prevBalance == undefined ? "undefined" : prevBalance.toDecimalString(4)}`);

  // We send discord messages whenever the balance changes from bad to good, or good to bad.
  const becameBad = (!prevBalance || prevBalance.gte(params.minBalance)) && balance.lt(params.minBalance);
  const becameGood = (prevBalance && prevBalance.lt(params.minBalance)) && balance.gte(params.minBalance);

  await params.prevBalance.set(balance);

  if (becameBad) {
    const message = `Signer ${params.signerId} (${signerAddress}) has a low eth balance ${balance.toDecimalString(4)}`;
    ctx.logger.info(message);
    await postDefconNotification('defcon3', message, ctx);
  }

  if (becameGood) {
    const message = `Signer ${params.signerId} (${signerAddress}) now has sufficient eth balance ${balance.toDecimalString(4)}`;
    ctx.logger.info(message);
    await postDefconNotification('defcon3', message, ctx);
  }

  return taskSuccessSilent();
}