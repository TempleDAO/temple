import { Chain, getChainById } from '@/chains';
import { DISCORD_WEBHOOK_URL_KEY, connectDiscord } from '@/common/discord';
import {
  TempleTaskDiscordEvent,
  TempleTaskDiscordMetadata,
  buildTempleTasksDiscordMessage,
  formatBigNumber,
} from '@/common/utils';
import { ITempleLineOfCredit, ITempleLineOfCredit__factory } from '@/typechain';
import { formatUnits, EventLog } from 'ethers';
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

  // TODO: debug function, delete before merging
  const checkAccPosition = async (accounts: string[]) => {
    accounts.forEach(async (a) => {
      ctx.logger.info(`**Acc to check ${a} **`);
      const position = await tlc.accountPosition(a);
      
      ctx.logger.info(`Position: ${JSON.stringify({
        collateral: formatUnits(position.collateral, 18),
        currentDebt: formatUnits(position.currentDebt, 18),
        maxBorrow: formatUnits(position.maxBorrow, 18),
        healthFactor: formatUnits(position.healthFactor, 18),
        loanToValueRatio: formatUnits(position.loanToValueRatio, 18),
      })}`)

    });
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
    await checkAccPosition(accBatch); // check accs position before liquidation
    const tx = await tlc.batchLiquidate(accBatch, {
      gasLimit: 1_000_000n,
    });
    await checkAccPosition(accBatch); // check accs position after liquidation

    const txReceipt = await tx.wait();
    if (!txReceipt) return taskSuccessSilent();

    // Grab the events
    const events: TempleTaskDiscordEvent[] = [];

    await txReceipt.logs.forEach((log) => {
      if (log instanceof EventLog) {
        // TODO: delete following interesRateUpdateEv logs once bot is working fine on sepolia
        ctx.logger.info(`event log fragment name: ${log.fragment.name}`);
        // test InterestRateUpdate filter is working
        const interesRateUpdateEv = matchAndDecodeEvent(
          log,
          tlc,
          tlc.filters.InterestRateUpdate()
        );
        if (interesRateUpdateEv) {
          ctx.logger.info(
            `newInterestRate: ${interesRateUpdateEv.newInterestRate}`
          );
        }

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
          collateral
          collateralUSD
          debt
          debtUSD
          enterTimestamp
          exitTimestamp
        }
      }
    }`,
  });

  return resp;
};
