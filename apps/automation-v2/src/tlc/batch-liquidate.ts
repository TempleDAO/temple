import { Chain, getChainById } from '@/chains';
import { DISCORD_WEBHOOK_URL_KEY, connectDiscord } from '@/common/discord';
import {
  TempleTaskDiscordEvent,
  TempleTaskDiscordMetadata,
  buildTempleTasksDiscordMessage,
  formatBigNumber,
  matchAndDecodeEvent,
} from '@/common/utils';
import { ITempleLineOfCredit, ITempleLineOfCredit__factory } from '@/typechain';
import { BigNumber } from "ethers";
import * as ethers from "ethers";
import { TaskContext, TaskResult, taskSuccess, taskSuccessSilent } from '@mountainpath9/overlord';
import { subgraphRequest } from '@/subgraph/subgraph-request';
import { GetUserResponse } from '@/subgraph/types';

export interface TlcBatchLiquidateConfig {
  CHAIN: Chain;
  WALLET_NAME: string;
  TLC_ADDRESS: string;
}

/** number from attos (ie, human readable) */
export function fromAtto(n: BigNumber): number {
  return Number.parseFloat(ethers.utils.formatUnits(n, 18));
}

export async function batchLiquidate(
  ctx: TaskContext,
  config: TlcBatchLiquidateConfig
): Promise<TaskResult> {
  const provider = await ctx.getProvider(config.CHAIN.id);
  const signer = await ctx.getSigner(provider, config.WALLET_NAME);
  ctx.logger.debug(`provider network: ${(await provider.getNetwork()).name}`);
  ctx.logger.debug(`signer address: ${await signer.getAddress()}`);
  ctx.logger.debug(`signer balance: ${await signer.getBalance()}`);
  ctx.logger.debug(`config.TLC_ADDRESS: ${await config.TLC_ADDRESS}`);

  const tlc: ITempleLineOfCredit = ITempleLineOfCredit__factory.connect(
    await config.TLC_ADDRESS,
    signer
  );
  
  // TODO: debug function, delete before merging
  const checkAccPosition = async (accounts: string[]) => {
    console.log();
    accounts.forEach( async a => {
      console.log('**Acc to check %s **', a);
      const position = await tlc.accountPosition(a);
      console.log('\t-collateral:       ', fromAtto(position.collateral));
      console.log('\t-currentDebt:      ', fromAtto(position.currentDebt));
      console.log('\t-maxBorrow:        ', fromAtto(position.maxBorrow));
      console.log('\t-healthFactor:     ', fromAtto(position.healthFactor));
      console.log('\t-loanToValueRatio: ', fromAtto(position.loanToValueRatio));
    })
    console.log();
  };

  const submittedAt = new Date();

  const url = getChainById(config.CHAIN.id).subgraphUrl;
  const res = await getTlcUsers(url);
  const tlcUsers = (await res()).data?.users;

  const accountsToCheck = tlcUsers?.flatMap((u) => u.id);
  // if zero users returned from subgraph, success silently
  if (!accountsToCheck) return taskSuccessSilent();
  
  checkAccPosition(accountsToCheck);
  const tx = await tlc.batchLiquidate(accountsToCheck);
  checkAccPosition(accountsToCheck);

  const txReceipt = await tx.wait();
  const txUrl = config.CHAIN.transactionUrl(txReceipt.transactionHash);
  // Grab the events
  const events: TempleTaskDiscordEvent[] = [];
  for (const ev of txReceipt?.events || []) {
    const liquidatedEv = matchAndDecodeEvent(
      tlc,
      tlc.filters.Liquidated(),
      ev
    );
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
  // if no liquidation happened, success silently
  // if (events.length === 0) return taskSuccessSilent(); // TODO: uncomment once event issue has been solved

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

const getTlcUsers = async(url: string) => {
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