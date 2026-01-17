import { BigRational } from "@mountainpath9/big-rational";
import { KvPersistedValue } from "@/utils/kv";
import { TaskContext, TaskResult,
  taskSuccess, taskSuccessSilent } from "@mountainpath9/overlord-core";
import { getPublicClient, getWalletClient, createTransactionManager, PublicClient } from "@mountainpath9/overlord-viem";
import { chainFromId, getMainnetSubmissionParams } from "@/config";
import { postDefconNotification } from "@/utils/discord";
import { etherscanTransactionUrl } from "@/utils/etherscan";
import { delayUntilNextCheckTime } from "@/utils/task-checks";
import { Address, encodeFunctionData, getContract, GetContractReturnType, maxUint256 } from "viem";
import * as Spice from "@/abi/ISpiceAuction";
import * as TempleGold from "@/abi/ITempleGold";
import { ExtractAbiFunction, AbiParametersToPrimitiveTypes } from "abitype";

const EMPTY_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
// avoid hot spots in code when iterating
const MAX_BACKCHECK_LENGTH = 10;

type EpochInfo = 
  AbiParametersToPrimitiveTypes<ExtractAbiFunction<typeof Spice.ABI, "getEpochInfo">["outputs"]>[0];

type SendParamOptions =
  AbiParametersToPrimitiveTypes<ExtractAbiFunction<typeof TempleGold.ABI, "quoteSend">["inputs"]>[0];

type Auction = GetContractReturnType<typeof Spice.ABI, PublicClient>;

export const taskIdPrefix = 'tgldspiceauction-a-';

export interface Params {
  signerId: string,
  chainId: number,
  contracts: { auctions: Address[], templeGold: Address },
  lastRunTime: KvPersistedValue<Date>;
  maxGasPrice: BigRational,
  checkPeriodMs: number,
  lastCheckTime: KvPersistedValue<Date>,
  mint_source_lz_eid: bigint,
  mint_chain_id: bigint
}

export async function burnAndUpdateCirculatingSupply(ctx: TaskContext, params: Params): Promise<TaskResult> {
  const chain = chainFromId(params.chainId);
  const pclient = await getPublicClient(ctx, chain);
  const wclient = await getWalletClient(ctx, chain, params.signerId);
  const transactionManager = await createTransactionManager(ctx, wclient, {...await getMainnetSubmissionParams(ctx)});

  const templeGold = getContract({
    address: params.contracts.templeGold,
    abi: TempleGold.ABI,
    client: pclient
  });

  // Overlord EOA approves spice auction contract to spend max TGLD if current approval is zero
  async function approveMaxTgld(auction: Auction): Promise<void> {
    const currentApproval = await templeGold.read.allowance([wclient.account.address, auction.address]);
    if (currentApproval == 0n) {
      const data = encodeFunctionData({
        abi: TempleGold.ABI,
        functionName: 'approve',
        args: [auction.address, maxUint256],
      });
      const tx = { data, to: params.contracts.templeGold };
      const txr = await transactionManager.submitAndWait(tx);

      ctx.logger.info(`Successfully approved spice auction ${await auction.read.name()} for TGLD spend.
        <${etherscanTransactionUrl(params.chainId, txr.transactionHash)}>`);
    }
  }

  async function getTotalBidTokenAmount(auction: Auction, epochId: bigint) {
    const epochInfo = await auction.read.getEpochInfo([epochId]);
    return epochInfo.totalBidTokenAmount;
  }

  async function gatherAllUnnotifiedEpochs(auction: Auction, sinceEpochId: bigint){
    const unnotifiedEpochs: Map<bigint, bigint> = new Map();
    let epochId = sinceEpochId;
    let counter = 0;
    while (epochId > 0n) {
      const notified = await auction.read.redeemedEpochs([epochId]);
      ctx.logger.info(`Epoch ${epochId} burn status: ${notified}`);
      if (!notified){
        // check auction token is TGLD
        let auctionTokenIsTgld = false;
        const auctionConfig = await auction.read.getAuctionConfig([epochId]);
        if (auctionConfig.isTempleGoldAuctionToken) {
          ctx.logger.info(`Auction token is TGLD for this epoch ${epochId}`);
          auctionTokenIsTgld = true;
        }
        // skip auctions with 0 bids. admin recovers and pulls spice tokens in single transaction
        const totalBidTokenAmount = await getTotalBidTokenAmount(auction, epochId);
        const totalBidAmountIsZero = assertTotalBidAmountNotZero(ctx, totalBidTokenAmount, Number(epochId));
        if (!auctionTokenIsTgld && !totalBidAmountIsZero) {
          unnotifiedEpochs.set(epochId, totalBidTokenAmount);
        }
      }
      epochId -= 1n;
      counter += 1;
      if (counter == MAX_BACKCHECK_LENGTH) {
        break;
      }
    }
    return unnotifiedEpochs;
  }
  // check last run time
  if (await assertLastRuntime(ctx, params)) { return taskSuccessSilent(); }
  // check max gas price
  if (await assertMaxGasPriceNotExceeded(ctx, params, pclient)) { return taskSuccessSilent(); }

  ctx.logger.info(`Auctions to check: ${params.contracts.auctions}`);
  for (const auctionAddress of params.contracts.auctions) {
    const auction = getContract({
      address: auctionAddress,
      abi: Spice.ABI,
      client: pclient
    });

    // get current epoch and start checking from next eligible epoch
    const currentEpoch = await auction.read.currentEpoch();
    const epochInfo: EpochInfo = await auction.read.getEpochInfo([currentEpoch]);

    // Set approval
    await approveMaxTgld(auction);

    let epochId = assertEpochNotEnded(ctx, epochInfo) ? currentEpoch - BigInt(1) : currentEpoch;
    const unnotifiedEpochs = await gatherAllUnnotifiedEpochs(auction, epochId);
    ctx.logger.info(`Unnotified epochs for auction ${auctionAddress} ${unnotifiedEpochs.size}`);
    for (epochId of Array.from(unnotifiedEpochs.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      // add gas fee if not on mainnet (source TGLD chain)
      let overrides = { value: 0n };
      ctx.logger.info(`ChainId: ${params.chainId}, mint source: ${params.mint_chain_id}`);
      if (BigInt(params.chainId) != params.mint_chain_id) {
        const totalBidTokenAmount = unnotifiedEpochs.get(epochId) as bigint;
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

      const tx = { ...overrides, data, to: auctionAddress };
      const txr = await transactionManager.submitAndWait(tx);

      ctx.logger.info(`Successfully burned TGLD for spice auction ${await auction.read.name()} for epoch ${epochId}`);

      const message = `_transaction_: <${etherscanTransactionUrl(params.chainId, txr.transactionHash)}>`;
      if (await postDefconNotification('defcon5', message, ctx)) {
        ctx.logger.info(`TGLD burn discord notification sent`);
      }
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
    ctx.logger.info(`skipping due to high gas price (${gasPrice.toDecimalString(5)} > ${params.maxGasPrice.toDecimalString(5)})`);
    return true;
  }
  return false;
}