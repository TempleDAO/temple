import {
  TaskContext,
  FallibleTaskResult,
  taskFailOnce,
  taskSuccessSilent,
} from '@mountainpath9/overlord';
import { formatBigNumber } from '@/common/utils';
import {
  DISCORD_WEBHOOK_URL_KEY,
  DiscordMesage,
  connectDiscord,
} from '@/common/discord';
import { Chain } from '@/chains';

export type CheckEthBalanceType = (chain: Chain) => CheckEthBalanceConfig;
export interface CheckEthBalanceConfig {
  CHAIN: Chain;
  WALLET_NAME: string;
  MIN_ETH_BALANCE: bigint;
}

export async function checkLowEthBalance(
  ctx: TaskContext,
  config: CheckEthBalanceConfig
): Promise<FallibleTaskResult> {
  const provider = await ctx.getProvider(config.CHAIN.id);
  const signer = await ctx.getSigner(provider, config.WALLET_NAME);
  const walletAddress = await signer.getAddress();
  const balance = await provider.getBalance(walletAddress);
  const ethBalanceStr = formatBigNumber(balance, 18, 6);

  const values = {
    ethBalance: ethBalanceStr,
    requiredBalance: formatBigNumber(config.MIN_ETH_BALANCE, 18, 6),
  };
  ctx.logger.info(`Check eth balance: ${JSON.stringify(values)}`);

  if (balance < config.MIN_ETH_BALANCE) {
    // Report low balance
    ctx.logger.error(
      `Eth balance below the required amount: ${JSON.stringify(values)}`
    );

    // Send alert notification
    const submittedAt = new Date();
    const message = await buildDiscordMessageCheckEth(
      config.CHAIN,
      submittedAt,
      walletAddress,
      balance,
      config.MIN_ETH_BALANCE
    );
    const webhookUrl = await ctx.getSecret(DISCORD_WEBHOOK_URL_KEY);
    const discord = await connectDiscord(webhookUrl, ctx.logger);
    await discord.postMessage(message);
    return taskFailOnce('Eth balance below the required amount');
  }
  return taskSuccessSilent();
}

export async function buildDiscordMessageCheckEth(
  chain: Chain,
  submittedAt: Date,
  watchAddress: string,
  ethBalance: bigint,
  minBalance: bigint
): Promise<DiscordMesage> {
  const content = [
    `**TEMPLE LOW ETH ALERT [${chain.name}]**`,
    ``,
    `_address:_ ${watchAddress}`,
    `_required eth:_ ${formatBigNumber(minBalance, 18, 6)}`,
    `_eth balance:_  ${formatBigNumber(ethBalance, 18, 6)}`,
    `_submitted at:_ ${submittedAt.toISOString()}`,
    ``,
    `${chain.addressUrl(watchAddress)}`,
  ];

  return {
    content: content.join('\n'),
  };
}
