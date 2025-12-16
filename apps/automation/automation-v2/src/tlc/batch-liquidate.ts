import { connectDiscord } from '@/utils/discord';
import {
  TempleTaskDiscordMetadata,
  buildDiscordMessageCheckEth,
  buildTempleTasksDiscordMessage,
  formatBigNumber,
} from './utils';
import { ABI as TLC_ABI } from '@/abi/ITempleLineOfCredit';
import {
  TaskResult,
  TaskContext,
  taskSuccess,
  taskSuccessSilent,
} from '@mountainpath9/overlord-core';
import { getPublicClient, getWalletClient, createTransactionManager } from "@mountainpath9/overlord-viem";
import { subgraphRequest } from './subgraph/subgraph-request';
import { GetUserResponse } from './subgraph/types';
import { backOff } from 'exponential-backoff';
import { tlc_discord_webhook_url } from './variables';
import { Address, Chain as ViemChain, getContract, getAddress,
  encodeFunctionData, decodeEventLog } from 'viem';
import { getSubmissionParams } from "@/config";
import { WebhookMessageCreateOptions } from 'discord.js';


export interface Chain {
  chain: ViemChain;
  name: string;
  transactionUrl(txhash: string): string;
  addressUrl(txhash: string): string;
}

export interface TlcBatchLiquidateConfig {
  CHAIN: Chain;
  WALLET_NAME: string;
  TLC_ADDRESS: Address;
  ACC_LIQ_MAX_CHUNK_NO: number;
  MIN_ETH_BALANCE_WARNING: bigint;
  GAS_LIMIT: bigint;
  SUBGRAPH_URL: string;
  SUBGRAPH_RETRY_LIMIT: number;
}

export async function batchLiquidate(
  ctx: TaskContext,
  config: TlcBatchLiquidateConfig
): Promise<TaskResult> {
  const pclient = await getPublicClient(ctx, config.CHAIN.chain);
  const wclient = await getWalletClient(ctx, config.CHAIN.chain, config.WALLET_NAME);
  const transactionManager = await createTransactionManager(ctx, wclient, {...await getSubmissionParams(ctx)});
  const walletAddress = wclient.account;
  const webhookUrl = await tlc_discord_webhook_url.requireValue(ctx);
  const discord = await connectDiscord(webhookUrl, ctx.logger);

  const tlc = getContract({
      address: config.TLC_ADDRESS,
      abi: TLC_ABI,
      client: pclient
  });

  const submittedAt = new Date();

  const chunkify = function (itr: Address[], size: number) {
    const chunk: Address[][] = [];
    let innerChunk: Address[] = [];
    for (const v of itr) {
      innerChunk.push(v);
      if (innerChunk.length === size) {
        chunk.push(innerChunk);
        innerChunk = [];
      }
    }
    if (innerChunk.length) chunk.push(innerChunk);
    return chunk;
  };

  // try first random subgraph api endpoint
  const res = await getTlcUsers(
    ctx,
    config.SUBGRAPH_URL,
    config.SUBGRAPH_RETRY_LIMIT
  );

  const tlcUsers = res.data.data?.tlcUsers;
  ctx.logger.info(`tlcUsers to check: ${JSON.stringify(tlcUsers)}`);
  // if undefined or zero users returned from subgraph, success silently
  if (!tlcUsers || tlcUsers.length === 0) return taskSuccessSilent();
  const accountsToCheck = tlcUsers.flatMap((u) => getAddress(u.id));
  if (accountsToCheck.length === 0) return taskSuccessSilent();

  // only liquidate the accounts which have exceeded the max ltv
  const compLiquidityAccs = await tlc.read.computeLiquidity([accountsToCheck]);
  const accsToLiquidate: Array<Address> = [];
  compLiquidityAccs.map((acc, i) => {
    if (acc.hasExceededMaxLtv) accsToLiquidate.push(accountsToCheck[i]);
  });
  if (accsToLiquidate.length === 0) return taskSuccessSilent();

  const messages: Array<WebhookMessageCreateOptions> = [];
  // chunk compLiquidityAccs to a max number of requests per batchLiquidate
  // e.g. try to liquidate 1000 accounts at once could use too much gas and fail
  const accListChunks = chunkify(accsToLiquidate, config.ACC_LIQ_MAX_CHUNK_NO);
  for (const accBatch of accListChunks) {
    const data = encodeFunctionData({
      abi: TLC_ABI,
      functionName: 'batchLiquidate',
      args: [accBatch]
    });
    const tx = { data, to: config.TLC_ADDRESS };
    const txr = await transactionManager.submitAndWait(tx);
    if (!txr) throw Error('undefined tx receipt');

    // Track number of events
    let numberOfEvents = 0;

    txr.logs.forEach((log) => {
      const decodedLog = decodeEventLog({
        abi: TLC_ABI,
        data: log.data,
        topics: log.topics,
      });

      // check if this is the liquidated event
      if (decodedLog.eventName === 'Liquidated') {
        const args = decodedLog.args;
        const details = [
          `account = \`${args.account}\``,
          `collateralValue = \`${formatBigNumber(
            args.collateralValue,
            18,
            4
          )}\``,
          `collateralSeized = \`${formatBigNumber(
            args.collateralSeized,
            18,
            4
          )}\``,
          `daiDebtWiped = \`${formatBigNumber(
            args.daiDebtWiped,
            18,
            4
          )}\``,
        ];
        numberOfEvents += 1;
        // Log the event details. Avoid bloating discord messages due to set 1k character limit
        ctx.logger.info( `\n_What_: Liquidated` + `${details.map((d) => `\n\t\t\t\t• ${d}`)}`);
      }
    });

    // Skip adding to discord messages if no liquidation happened in this chunk
    if (numberOfEvents === 0) continue;

    const txUrl = config.CHAIN.transactionUrl(txr.transactionHash);
    const metadata: TempleTaskDiscordMetadata = {
      title: 'TLC Batch Liquidate',
      numberOfEvents,
      submittedAt,
      txReceipt: txr,
      txUrl,
    };

    // Add to messages for later notification
    const message = await buildTempleTasksDiscordMessage(
      pclient,
      config.CHAIN.name,
      metadata
    );
    messages.push(message);
  }

  // Post discord messages if any. Truncate messages to 1k characters
  if (messages.length > 0) {
    for (const message of messages) {
       if (message.content){
        message.content = `${message.content.slice(0, 996)} ...`
        await discord.postMessage(message)
      }
    }
  }

  // Send discord alert warning if signer wallet doesn't have sufficient eth balance
  const ethBalance = await pclient.getBalance({ address: walletAddress.address });
  if (ethBalance < config.MIN_ETH_BALANCE_WARNING) {
    const ethBalanceMessage = await buildDiscordMessageCheckEth(
      config.CHAIN,
      submittedAt,
      walletAddress.address,
      ethBalance,
      config.MIN_ETH_BALANCE_WARNING
    );
    await discord.postMessage(ethBalanceMessage);
  }
  return taskSuccess();
}

const getTlcUsers = async (ctx: TaskContext, url: string, retries: number) => {
  return backOff(
    subgraphRequest<GetUserResponse>(
      url,
      {
        query: `{
        tlcUsers(where: {debt_gt: "0"}) {
          id
        }
      }`,
      },
      ctx.logger
    ),
    {
      numOfAttempts: retries,
      retry: (e, attemptNumber) => {
        if (e instanceof Error) {
          ctx.logger.error(`subgraph retry no ${attemptNumber}`);
          ctx.logger.error(`${JSON.stringify(e)}`);
          return true;
        }
        return false;
      },
      startingDelay: 200, // The delay, in milliseconds, before executing the function for the first time. Default value is 100 ms.
    }
  );
};
