import { Chain, getChainById } from '@/chains';
import { DISCORD_WEBHOOK_URL_KEY, connectDiscord } from '@/common/discord';
import {
  TempleTaskDiscordEvent,
  TempleTaskDiscordMetadata,
  buildTempleTasksDiscordMessage,
  formatBigNumber,
} from '@/common/utils';
import { ITempleLineOfCredit, ITempleLineOfCredit__factory } from '@/typechain';
import { EventLog } from 'ethers';
import {
  TaskContext,
  TaskResult,
  taskSuccess,
  taskSuccessSilent,
} from '@mountainpath9/overlord';
import { subgraphRequest } from '@/subgraph/subgraph-request';
import { GetUserResponse } from '@/subgraph/types';
import { matchAndDecodeEvent } from '@/common/filters';
import { buildDiscordMessageCheckEth } from '@/common/eth-auto-checker';

export interface TlcBatchLiquidateConfig {
  CHAIN: Chain;
  WALLET_NAME: string;
  TLC_ADDRESS: string;
  ACC_LIQ_MAX_CHUNK_NO: number;
  MIN_ETH_BALANCE: bigint;
  GAS_LIMIT: bigint;
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

  const submittedAt = new Date();

  const url = getChainById(config.CHAIN.id).subgraphUrl;
  const res = await getTlcUsers(url);
  const tlcUsers = (await res()).data?.users;
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
  accListChunks.forEach(async (accBatch) => {
    const tx = await tlc.batchLiquidate(accBatch, {
      gasLimit: config.GAS_LIMIT,
    });

    const txReceipt = await tx.wait();
    if (!txReceipt) return taskSuccessSilent();

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

    // Send discord alert if signer wallet doesn't have sufficient eth balance
    const ethBalance = await provider.getBalance(walletAddress);
    if (ethBalance < config.MIN_ETH_BALANCE) {
      const ethBalanceMessage = await buildDiscordMessageCheckEth(
        config.CHAIN,
        submittedAt,
        walletAddress,
        ethBalance,
        config.MIN_ETH_BALANCE
      );

      await discord.postMessage(ethBalanceMessage);
    }
  });

  return taskSuccess();
}

const getTlcUsers = async (url: string) => {
  const resp = await subgraphRequest<GetUserResponse>(url, {
    query: `{
      users {
        ... on TlcUser {
          id
        }
      }
    }`,
  });

  return resp;
};
