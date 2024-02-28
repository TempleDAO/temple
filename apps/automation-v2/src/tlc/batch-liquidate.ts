import { Chain } from '@/chains';
import { DISCORD_WEBHOOK_URL_KEY, connectDiscord } from '@/common/discord';
import {
  TempleTaskDiscordEvent,
  TempleTaskDiscordMetadata,
  buildDiscordMessageCheckEth,
  buildTempleTasksDiscordMessage,
  formatBigNumber,
} from '@/common/utils';
import { ITempleLineOfCredit, ITempleLineOfCredit__factory } from '@/typechain';
import { EventLog } from 'ethers';
import {
  TaskResult,
  TaskContext,
  taskSuccess,
  taskSuccessSilent,
} from '@mountainpath9/overlord';
import { subgraphRequest } from '@/subgraph/subgraph-request';
import { GetUserResponse } from '@/subgraph/types';
import { matchAndDecodeEvent } from '@/common/filters';
import { backOff } from 'exponential-backoff';
import { AxiosResponse } from 'axios';

export interface TlcBatchLiquidateConfig {
  CHAIN: Chain;
  WALLET_NAME: string;
  TLC_ADDRESS: string;
  ACC_LIQ_MAX_CHUNK_NO: number;
  MIN_ETH_BALANCE_WARNING: bigint;
  GAS_LIMIT: bigint;
  SUBGRAPH_URL: string;
  SUBGRAPH_ALCHEMY_URL: string;
  SUBGRAPH_RETRY_LIMIT: number;
}

export async function batchLiquidate(
  ctx: TaskContext,
  config: TlcBatchLiquidateConfig
): Promise<TaskResult> {
  const provider = await ctx.getProvider(config.CHAIN.id);
  const signer = await ctx.getSigner(provider, config.WALLET_NAME);
  const walletAddress = await signer.getAddress();
  const webhookUrl = await ctx.getSecret(DISCORD_WEBHOOK_URL_KEY);
  const discord = await connectDiscord(webhookUrl, ctx.logger);

  const tlc: ITempleLineOfCredit = ITempleLineOfCredit__factory.connect(
    await config.TLC_ADDRESS,
    signer
  );

  const submittedAt = new Date();

  const chunkify = function (itr: string[], size: number) {
    const chunk: string[][] = [];
    let innerChunk: string[] = [];
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

  let res: AxiosResponse<GetUserResponse> | undefined = undefined;
  const randomUrlFirstAlchemyApi = Math.random() < 0.5;
  try {
    // try first random subgraph api endpoint
    res = await getTlcUsers(
      ctx,
      randomUrlFirstAlchemyApi ? config.SUBGRAPH_ALCHEMY_URL : config.SUBGRAPH_URL,
      config.SUBGRAPH_RETRY_LIMIT
    );
  } catch (e) {
    // if first fails, try the second endpoint option
    res = await getTlcUsers(
      ctx,
      randomUrlFirstAlchemyApi ? config.SUBGRAPH_URL : config.SUBGRAPH_ALCHEMY_URL,
      config.SUBGRAPH_RETRY_LIMIT
    );
  }

  const tlcUsers = res.data.data?.tlcUsers;
  ctx.logger.info(`tlcUsers to check: ${JSON.stringify(tlcUsers)}`);
  // if undefined or zero users returned from subgraph, success silently
  if (!tlcUsers || tlcUsers.length === 0) return taskSuccessSilent();
  const accountsToCheck = tlcUsers.flatMap((u) => u.id);
  if (accountsToCheck.length === 0) return taskSuccessSilent();

  // only liquidate the accounts which have exceeded the max ltv
  const compLiquidityAccs = await tlc.computeLiquidity(accountsToCheck);
  const accsToLiquidate: Array<string> = [];
  compLiquidityAccs.map((acc, i) => {
    if (acc.hasExceededMaxLtv) accsToLiquidate.push(accountsToCheck[i]);
  });
  if (accsToLiquidate.length === 0) return taskSuccessSilent();

  // chunk compLiquidityAccs to a max number of requests per batchLiquidate
  // e.g. try to liquidate 1000 accounts at once could use too much gas and fail
  const accListChunks = chunkify(accsToLiquidate, config.ACC_LIQ_MAX_CHUNK_NO);
  for (const accBatch of accListChunks) {
    const tx = await tlc.batchLiquidate(accBatch, {
      gasLimit: config.GAS_LIMIT,
    });
    const txReceipt = await tx.wait();
    if (!txReceipt) throw Error('undefined tx receipt');

    // Grab the events
    const events: TempleTaskDiscordEvent[] = [];

    await txReceipt.logs.forEach((log) => {
      if (log instanceof EventLog) {
        const liquidatedEv = matchAndDecodeEvent(
          log,
          tlc,
          tlc.filters.Liquidated()
        );

        // check if this is the liquidated event
        if (liquidatedEv) {
          events.push({
            what: 'Liquidated',
            details: [
              `account = \`${liquidatedEv.account}\``,
              `collateralValue = \`${formatBigNumber(
                liquidatedEv.collateralValue,
                18,
                4
              )}\``,
              `collateralSeized = \`${formatBigNumber(
                liquidatedEv.collateralSeized,
                18,
                4
              )}\``,
              `daiDebtWiped = \`${formatBigNumber(
                liquidatedEv.daiDebtWiped,
                18,
                4
              )}\``,
            ],
          });
        }
      }
    });

    // if no liquidation happened, success silently
    if (events.length === 0) return taskSuccessSilent();

    const txUrl = config.CHAIN.transactionUrl(txReceipt.hash);
    const metadata: TempleTaskDiscordMetadata = {
      title: 'TLC Batch Liquidate',
      events,
      submittedAt,
      txReceipt,
      txUrl,
    };

    // Send notification
    const message = await buildTempleTasksDiscordMessage(
      provider,
      config.CHAIN,
      metadata
    );
    await discord.postMessage(message);
  }

  // Send discord alert warning if signer wallet doesn't have sufficient eth balance
  const ethBalance = await provider.getBalance(walletAddress);
  if (ethBalance < config.MIN_ETH_BALANCE_WARNING) {
    const ethBalanceMessage = await buildDiscordMessageCheckEth(
      config.CHAIN,
      submittedAt,
      walletAddress,
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
