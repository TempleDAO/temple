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

export interface TlcBatchLiquidateConfig {
  CHAIN: Chain;
  WALLET_NAME: string;
  TLC_ADDRESS: string;
}

export async function batchLiquidate(
  ctx: TaskContext,
  config: TlcBatchLiquidateConfig
): Promise<TaskResult> {
  const provider = await ctx.getProvider(config.CHAIN.id);
  const signer = await ctx.getSigner(provider, config.WALLET_NAME);
  const signerAddress = await signer.getAddress();
  ctx.logger.debug(`provider network: ${(await provider.getNetwork()).name}`);
  ctx.logger.debug(`signer address: ${signerAddress}`);
  ctx.logger.debug(
    `signer balance: ${await provider.getBalance(signerAddress)}`
  );
  ctx.logger.debug(`config.TLC_ADDRESS: ${await config.TLC_ADDRESS}`);

  const tlc: ITempleLineOfCredit = ITempleLineOfCredit__factory.connect(
    await config.TLC_ADDRESS,
    signer
  );

  // TODO: debug function, delete before merging
  const checkAccPosition = async (accounts: string[]) => {
    console.log();
    accounts.forEach(async (a) => {
      console.log('**Acc to check %s **', a);
      const position = await tlc.accountPosition(a);
      console.log(
        '\t-collateral:       ',
        formatUnits(position.collateral, 18)
      );
      console.log(
        '\t-currentDebt:      ',
        formatUnits(position.currentDebt, 18)
      );
      console.log('\t-maxBorrow:        ', formatUnits(position.maxBorrow, 18));
      console.log(
        '\t-healthFactor:     ',
        formatUnits(position.healthFactor, 18)
      );
      console.log(
        '\t-loanToValueRatio: ',
        formatUnits(position.loanToValueRatio, 18)
      );
    });
    console.log();
  };

  const submittedAt = new Date();

  const url = getChainById(config.CHAIN.id).subgraphUrl;
  const res = await getTlcUsers(url);
  const tlcUsers = (await res()).data?.users;

  const accountsToCheck = tlcUsers?.flatMap((u) => u.id);
  // if undefiner or zero users returned from subgraph, success silently
  if (!accountsToCheck) return taskSuccessSilent();
  if (accountsToCheck.length === 0) return taskSuccessSilent();

  // only liquidate the accounts which have exceeded the max ltv
  const compLiquidityAccs = await tlc.computeLiquidity(accountsToCheck);
  const accsToLiquidate: Array<string> = [];
  compLiquidityAccs.map( (acc, i) => {
    if(acc.hasExceededMaxLtv) accsToLiquidate.push(accountsToCheck[i]);
  });
  checkAccPosition(accountsToCheck);
  
  // TODO: Liquidate in batch of max 100 users (e.g. pagination) to avoid tx with too much gas which could fail
  const tx = await tlc.batchLiquidate(accsToLiquidate, {
    gasLimit: 1_000_000n,
  });
  checkAccPosition(accountsToCheck);

  const txReceipt = await tx.wait();
  if (!txReceipt) return taskSuccessSilent();

  // Grab the events
  const events: TempleTaskDiscordEvent[] = [];

  await txReceipt.logs.forEach((log) => {
    if (log instanceof EventLog) {
      console.log('event logs', {
        fragment: log.fragment,
        decoded: tlc.interface.decodeEventLog(
          log.fragment,
          log.data,
          log.topics
        ),
      });
      const interesRateUpdateEv = matchAndDecodeEvent(log, tlc, tlc.filters.InterestRateUpdate());
      if(interesRateUpdateEv){
        console.log('newInterestRate: ', interesRateUpdateEv.newInterestRate);
      }
      
      const liquidatedEv = matchAndDecodeEvent(log, tlc, tlc.filters.Liquidated());
      
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
    } else {
      console.log('logs', {
        log,
        decoded: tlc.interface.parseLog({
          topics: log.topics.map((t) => t),
          data: log.data,
        }),
      });
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
  const webhookUrl = await ctx.getSecret(DISCORD_WEBHOOK_URL_KEY);
  const discord = await connectDiscord(webhookUrl, ctx.logger);
  await discord.postMessage(message);

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
