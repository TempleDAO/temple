import { BigRational } from "@mountainpath9/big-rational";
import { KvPersistedValue } from "@/utils/kv";
import { TaskContext, TaskResult,
  taskSuccess, taskSuccessSilent } from "@mountainpath9/overlord-core";
import { getPublicClient, getWalletClient, createTransactionManager, PublicClient } from "@mountainpath9/overlord-viem";
import { chainFromId, TX_SUBMISSION_PARAMS } from "@/config";
import { postDefconNotification } from "@/utils/discord";
import { etherscanTransactionUrl } from "@/utils/etherscan";
import { delayUntilNextCheckTime } from "@/utils/task-checks";
import { BigNumberish } from "ethers";
import { Address, encodeFunctionData, getContract } from "viem";
import * as Spice from "@/abi/ISpiceAuction";
import * as TempleGold from "@/abi/ITempleGold";
import * as AuctionBase from "@/abi/IAuctionBase";
import { ExtractAbiFunction, AbiParametersToPrimitiveTypes } from "abitype";

const EMPTY_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
// avoid hot spots in code when iterating
const MAX_BACKCHECK_LENGTH = 10;

type EpochInfo = 
  AbiParametersToPrimitiveTypes<ExtractAbiFunction<typeof AuctionBase.ABI, "getEpochInfo">["outputs"]>[0];

type SendParamOptions =
  AbiParametersToPrimitiveTypes<ExtractAbiFunction<typeof TempleGold.ABI, "quoteSend">["inputs"]>[0];

export const taskIdPrefix = 'tgldspiceauction-a-';

export interface Params {
  signerId: string,
  chainId: number,
  contracts: { spice: Address, templeGold: Address },
  lastRunTime: KvPersistedValue<Date>;
  maxGasPrice: BigRational,
  checkPeriodMs: number,
  lastCheckTime: KvPersistedValue<Date>,
  mint_source_lz_eid: BigNumberish,
  mint_chain_id: BigNumberish
}

export async function redeemTempleGold(ctx: TaskContext, params: Params): Promise<TaskResult> {
  const chain = chainFromId(params.chainId);
  const pclient = await getPublicClient(ctx, chain);
  const wclient = await getWalletClient(ctx, chain, params.signerId);
  const transactionManager = await createTransactionManager(ctx, wclient, {...TX_SUBMISSION_PARAMS});

  const spice = getContract({
    address: params.contracts.spice,
    abi: Spice.ABI,
    client: pclient
  });
  const auctionBase = getContract({
    abi: AuctionBase.ABI,
    address: params.contracts.spice,
    client: pclient
  });
  const templeGold = getContract({
    address: params.contracts.templeGold,
    abi: TempleGold.ABI,
    client: pclient
  });

  async function getTotalBidTokenAmount(epochId: bigint) {
    const epochInfo = await auctionBase.read.getEpochInfo([epochId]);
    return epochInfo.totalBidTokenAmount;
  }

  async function gatherAllUnredeemedEpochs(sinceEpochId: bigint){
    const unredeemedEpochs: bigint[] = [];
    let epochId = sinceEpochId;
    let counter = 0;
    while (epochId > 0n) {
      const redeemed = await spice.read.redeemedEpochs([epochId]);
      if (!redeemed){
        // check auction token is TGLD
        let auctionTokenIsTgld = false;
        const auctionConfig = await spice.read.getAuctionConfig([epochId]);
        if (auctionConfig.isTempleGoldAuctionToken) {
          ctx.logger.info(`Auction token is TGLD for this epoch ${epochId}`);
          auctionTokenIsTgld = true;
        }
        // skip auctions with 0 bids. admin recovers and redeems these ones in single transaction
        const totalBidTokenAmount = await getTotalBidTokenAmount(epochId);
        const totalBidAmountIsZero = assertTotalBidAmountNotZero(ctx, totalBidTokenAmount, Number(epochId));
        if (!auctionTokenIsTgld && !totalBidAmountIsZero) {
          unredeemedEpochs.push(epochId);
        }
      }
      epochId -= 1n;
      counter += 1;
      if (counter == MAX_BACKCHECK_LENGTH) {
        break;
      }
    }
    return unredeemedEpochs;
  }

  // check last run time
  if (await assertLastRuntime(ctx, params)) { return taskSuccessSilent(); }
  // check max gas price
  if (await assertMaxGasPriceNotExceeded(ctx, params, pclient)) { return taskSuccessSilent(); }

  // get current epoch and start checking from next eligible epoch
  const currentEpoch = await spice.read.currentEpoch();
  const epochInfo: EpochInfo = await auctionBase.read.getEpochInfo([currentEpoch]);
  let epochId = assertEpochNotEnded(ctx, epochInfo) ? currentEpoch - BigInt(1) : currentEpoch;
  const unredeemedEpochs = await gatherAllUnredeemedEpochs(epochId);
  for (epochId of unredeemedEpochs.sort((a, b) => Number(a-b))) {
    // add gas fee if not on mainnet (source TGLD chain)
    let overrides = { value: 0n };
    console.log(`ChainId: ${params.chainId}, mint source: ${params.mint_chain_id}`);
    if (params.chainId != params.mint_chain_id) {
      const totalBidTokenAmount = await getTotalBidTokenAmount(epochId);
      // get send quote
      const sendParam: SendParamOptions = {
        dstEid: Number(params.mint_source_lz_eid),
        to: EMPTY_BYTES32,
        amountLD: totalBidTokenAmount,
        minAmountLD: 0n,
        extraOptions: "0x", // assumes extraOptions has been set on TGLD
        composeMsg: "0x",
        oftCmd: "0x"
      };
      const fee = await templeGold.read.quoteSend([sendParam, false]);
      overrides.value = fee.nativeFee;
    }
    const data = encodeFunctionData({
      abi: Spice.ABI,
      functionName: 'burnAndNotify',
      args: [epochId, false],
    });
    const tx = { ...overrides, data, to: params.contracts.spice };
    const txr = await transactionManager.submitAndWait(tx);

    ctx.logger.info(`Successfully redeemed TGLD for spice auction ${await spice.read.name()} for epoch ${epochId}`);

    const message = `_transaction_: <${etherscanTransactionUrl(params.chainId, txr.transactionHash)}>`;
    if (await postDefconNotification('defcon5', message, ctx)) {
      ctx.logger.info(`Staking distribution discord notification sent`);
    }
  }
  return taskSuccess();
}

function assertEpochNotEnded(ctx: TaskContext, epochInfo: EpochInfo) {
  const now = new Date();
  if (epochInfo.endTime > Math.round(now.getTime()/1000)) {
    ctx.logger.info(`Auction has not ended.`);
    return true;
  }
  return false;
}

function assertTotalBidAmountNotZero(ctx: TaskContext, amount: bigint, epochId: number): Boolean {
  if (amount == BigInt(0)) {
    ctx.logger.info(`Total bid token amount for epoch ${epochId} is 0`);
    return true;
  }
  return false;
}

async function assertLastRuntime(ctx: TaskContext, params: Params): Promise<Boolean> {
  const now = new Date();
  if (await delayUntilNextCheckTime(params.checkPeriodMs, params.lastCheckTime, now)) {
    ctx.logger.info(`skipping as burning and notify not due`);
    return true;
  }
  return false;
}

async function assertMaxGasPriceNotExceeded(ctx: TaskContext, params: Params, provider: PublicClient): Promise<Boolean> {
  const estimate = await provider.estimateFeesPerGas();
  const gasPrice = BigRational.fromBigIntWithDecimals(estimate.maxFeePerGas || 0n, 9n);
  if (gasPrice.gt(params.maxGasPrice)) {
    ctx.logger.info(`skipping due to high gas price (${gasPrice.toDecimalString(0)} > (${params.maxGasPrice.toDecimalString(0)}`);
    return true;
  }
  return false;
}