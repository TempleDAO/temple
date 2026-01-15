import { Logger, SignerConfig, TaskContext, TaskResult,
    createTaskRunnerWithConfig,
    getAllVariableMetadata, makeLocalManagerConfig, makeManagerConfig, makeSignerKind, makeTaskRunnerConfig, taskSuccess } from "@mountainpath9/overlord-core";
import { Config, getConfig } from "@/config";
import { taskExceptionHandler } from "../utils/task-exceptions";
import * as stableGoldAuctionStart from "../tasks/stable-gold-auction-start";
import * as stableGoldAuctionDistributeTgld from "../tasks/stable-gold-auction-distribute-gold";
import * as vars from "@/config/variables";
import { JB_DATE, kvPersistedValue } from "@/utils/kv";
import * as stakingDistributeRewardsa from "../tasks/staking-distribute-rewards";
import * as burnAndNotify from "../tasks/spice-auction-burn-and-notify";
import { startSidebarBot } from "../tasks/discord-sidebar-auction";
import { updateAuctionSidebarBotTask, getSpiceAuctions } from "../tasks";
import { batchLiquidate } from "@/tlc/batch-liquidate";
import { TLC_BATCH_LIQUIDATE_CONFIG } from '@/tlc/config';
import { Address, BaseError, Client, ContractFunctionRevertedError, createTestClient, formatEther, getContract, Hex, http, parseEther, publicActions, TestClient, TestClientConfig, toHex, walletActions } from "viem";
import { getAccount } from "@mountainpath9/overlord-viem";
import { mainnet } from "viem/chains";
import * as ITreasuryPriceIndexOracle from '@/abi/ITreasuryPriceIndexOracle';
import * as ITempleElevatedAccess from '@/abi/ITempleElevatedAccess';
import * as IStableGoldAuction from "@/abi/IStableGoldAuction";
import * as ISpiceAuction from "@/abi/ISpiceAuction";
import * as ITempleGoldStaking from "@/abi/ITempleGoldStaking";

const ANVIL_URL = 'http://127.0.0.1:8545';
const ANVIL_PRIVATE_KEY_0 =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const TASK_RUNNER_CONFIG = makeTaskRunnerConfig({
  label: 'temple-localfork',
  http_port: 8111,
  manager: makeManagerConfig(
    'local',
    makeLocalManagerConfig({
      providers: [
        { chain_id: 1, rpc_url: ANVIL_URL },
      ],
      signers: [
        link('owner', ANVIL_PRIVATE_KEY_0),
        link('tgld_daigold_auction_signer', ANVIL_PRIVATE_KEY_0),
        link('temple_automation', ANVIL_PRIVATE_KEY_0),
        link('tgld_staking_signer', ANVIL_PRIVATE_KEY_0),
      ],
      vars: {
        env: 'mainnet',
        stablegoldauction_start_auction_max_gas_price: 420.69,
        burn_tgld_max_gas_price: 100,
        // Create your own personal discord server and create a webhook
        // tlc_discord_webhook_url: 'https://discord.com/api/webhooks/xxx/yyy',
      },
    })
  ),
});

function link(wallet_name: string, private_key: string): SignerConfig {
  return {
    wallet_name,
    chain_id: 1,
    kind: makeSignerKind('private_key', private_key),
  };
}

async function main() {
    const runner = createTaskRunnerWithConfig(TASK_RUNNER_CONFIG);
    const env = await runner.config.requireString(vars.env.name());
    const config = getConfig(env);

    runner.setTaskExceptionHandler(taskExceptionHandler);
    console.log("setting variables");
    runner.setConfigVariables(getAllVariableMetadata());

    const discordAuctionBot = await startSidebarBot(runner);

    runner.addWebhookTask({
        id: 'tlc-setup-liquidations',
        action: (ctx) => tlcSetupLiquidations(config, ctx),
    });
    runner.addWebhookTask({
        id: 'tlc-batch-liquidate',
        action: (ctx) => batchLiquidate(ctx, TLC_BATCH_LIQUIDATE_CONFIG),
    });

    runner.addWebhookTask({
      id: 'stable-auction-test-setup',
      action: (ctx) => stableAuctionTestSetup(config, ctx),
    });

    runner.addWebhookTask({
        id: stableGoldAuctionStart.taskIdPrefix + 'start',
        action: (ctx) => stableGoldAuctionStartAuction(config, ctx),
    });

    runner.addWebhookTask({
        id: stableGoldAuctionDistributeTgld.taskIdPrefix + 'distribute',
        action: (ctx) => stableGoldAuctionDistributeGold(config, ctx),
    });

    runner.addWebhookTask({
      id: 'staking-test-setup',
      action: (ctx) => stakingTestSetup(config, ctx),
    });

    runner.addWebhookTask({
        id: stakingDistributeRewardsa.taskIdPrefix + 'distribute',
        action: (ctx) => stakingDistributeRewards(config, ctx),
    });

    runner.addWebhookTask({
      id: 'spice-auction-test-setup',
      action: (ctx) => spiceAuctionTestSetup(config, ctx),
    });
    runner.addWebhookTask({
        id: burnAndNotify.taskIdPrefix + 'burn-and-notify',
        action: (ctx) => burnTempleGold(config, ctx),
    });

    // We need a periodic task to keep the task runner alive
    runner.addPeriodicTask({
        id: 'keepalive',
        cronSchedule: '0 * * * *',
        action: async (_ctx) => {
            return taskSuccess();
        }
    });

    runner.addWebhookTask({
        id: 'refresh-auction-bot',
        action: (ctx)=> updateAuctionSidebarBotTask(config, ctx, discordAuctionBot)
    })
    runner.main();
}

function getCustomErrorName(e: unknown): string | undefined {
  if (e instanceof BaseError) {
    const revertError = e.walk(
      (err) => err instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName;
    }
  }
}

// Run the given action. If an exception is thrown, run the given callback.
export async function withTxError<T>(
  action: () => Promise<T>,
  logger: Logger,
) {
  try {
    const v = await action();
    return v;
  } catch (e: unknown) {
    logger.error(`Exception during chain transactions`);

    let message = 'Something went wrong';
    if (e instanceof BaseError) {
      message = `${e.name}: ${e.shortMessage}`;
      const cError = getCustomErrorName(e);
      if (cError) {
        if (!message.endsWith('.')) message += '.';
        message += ` Revert Reason: ${cError}`;
      }
    }

    logger.error(message);
    throw e;
  }
}

async function stableAuctionTestSetup(config: Config, ctx: TaskContext) {
  // Handover operations to test client wallet address
  const tclient = createTestClient({
    account: await getAccount(ctx, 'owner'),
    chain: mainnet,
    mode: 'anvil',
    transport: http(await ctx.getProviderUrl(mainnet.id)),
  })
    .extend(publicActions)
    .extend(walletActions);

  const executorAddress = await tclient.readContract({
    abi: ITempleElevatedAccess.ABI,
    address: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD as Address,
    functionName: 'executor',
  });
  await impersonateExecutor(tclient, executorAddress);

  // Set auction starter
  const auction = getContract({
    address: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD as Address,
    abi: IStableGoldAuction.ABI,
    client: tclient
  });

  // Fast forward to end of epoch
  const skipForward = async (secs: bigint) => {
    await tclient.request({
      method: 'anvil_mine',
      params: [toHex(1), toHex(secs)],
    });
  }
  const currentEpoch = await auction.read.currentEpoch();
  const epochInfo = await auction.read.getEpochInfo([currentEpoch]);
  const nowSecs = Math.floor(Date.now() / 1000);
  const diff = epochInfo.endTime > nowSecs ? epochInfo.endTime - BigInt(nowSecs) : BigInt(0);
  
  if (diff > 0) {
    await skipForward(diff);
  }
  
  ctx.logger.info(`Setting auction starter to: ${tclient.account.address}`);

  const hash = await tclient.writeContract({
    abi: IStableGoldAuction.ABI,
    address: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD,
    functionName: 'setAuctionStarter',
    args: [tclient.account.address],
    account: executorAddress,
  });
  const txReceipt = await tclient.waitForTransactionReceipt({ hash });
  console.log(txReceipt);

  return taskSuccess();
}

async function stakingTestSetup(config: Config, ctx: TaskContext) {
  // Handover operations to test client wallet address
  const tclient = createTestClient({
    account: await getAccount(ctx, 'owner'),
    chain: mainnet,
    mode: 'anvil',
    transport: http(await ctx.getProviderUrl(mainnet.id)),
  })
    .extend(publicActions)
    .extend(walletActions);

  const executorAddress = await tclient.readContract({
    abi: ITempleElevatedAccess.ABI,
    address: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING as Address,
    functionName: 'executor',
  });
  await impersonateExecutor(tclient, executorAddress);

  ctx.logger.info(`Setting staking distribution starter to: ${tclient.account.address}`);
  // Set staking distribution starter
  const hash = await tclient.writeContract({
    abi: ITempleGoldStaking.ABI,
    address: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING,
    functionName: 'setDistributionStarter',
    args: [tclient.account.address],
    account: executorAddress,
  });
  const txReceipt = await tclient.waitForTransactionReceipt({ hash });
  console.log(txReceipt);

  return taskSuccess();
}

async function spiceAuctionTestSetup(config: Config, ctx: TaskContext) {
  // Handover operations to test client wallet address
  const tclient = createTestClient({
    account: await getAccount(ctx, 'owner'),
    chain: mainnet,
    mode: 'anvil',
    transport: http(await ctx.getProviderUrl(mainnet.id)),
  })
    .extend(publicActions)
    .extend(walletActions);

  // Executor is same across auctions
  const executorAddress = await tclient.readContract({
    abi: ISpiceAuction.ABI,
    address: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_SPICE.ENA as Address,
    functionName: 'daoExecutor',
  });
  await impersonateExecutor(tclient, executorAddress);

  // Set operator
  ctx.logger.info(`Setting operator to: ${tclient.account.address}`);
  
  const auctionAddresses = getSpiceAuctions(config.contracts);
  for (const auctionAddress of auctionAddresses) {
    const hash = await tclient.writeContract({
      abi: ISpiceAuction.ABI,
      address: auctionAddress,
      functionName: 'setOperator',
      args: [tclient.account.address],
      account: executorAddress,
    });
    const txReceipt = await tclient.waitForTransactionReceipt({ hash });
    console.log(txReceipt);
  }
  
  return taskSuccess();
}

async function impersonateExecutor(client: TestClient, executorAddress: Address) {
  await client.impersonateAccount({
    address: executorAddress,
  });

  // Make sure the executor has some gas
  await client.setBalance({
    address: executorAddress,
    value: parseEther('100'),
  });
}

async function tlcSetupLiquidations(config: Config, ctx: TaskContext) {
  const tclient = createTestClient({
    account: await getAccount(ctx, 'owner'),
    chain: mainnet,
    mode: 'anvil',
    transport: http(await ctx.getProviderUrl(mainnet.id)),
  })
    .extend(publicActions)
    .extend(walletActions);
  
  const executorAddress = await tclient.readContract({
    abi: ITempleElevatedAccess.ABI,
    address: config.contracts.TREASURY_RESERVES_VAULT.TPI_ORACLE as Address,
    functionName: 'executor',
  });
  await tclient.impersonateAccount({
    address: executorAddress,
  });

  // make sure the executor has some gas
  await tclient.setBalance({
    address: executorAddress,
    value: parseEther('100'),
  });

  const tpiOracle = getContract({
    address: config.contracts.TREASURY_RESERVES_VAULT.TPI_ORACLE as Address,
    abi: ITreasuryPriceIndexOracle.ABI,
    client: tclient
  });
  const tpiBefore = await tpiOracle.read.treasuryPriceIndex();
  ctx.logger.info(`TPI Before: ${formatEther(tpiBefore)}`);

  const latestTimestamp = async () => {
    const currentBlock = await tclient.getBlock();
    return Number(currentBlock.timestamp);
  }

  const skipForward = async (secs: bigint) => {
    await tclient.request({
      method: 'anvil_mine',
      params: [toHex(1), toHex(secs)],
    });
  }

  // Sets to 0.5 in one second
  const TPI_TARGET = parseEther("0.5");
  const txs = [
    async () => await tpiOracle.simulate.setMaxTreasuryPriceIndexDelta([parseEther("100")], {account: executorAddress}),
    async () => await tpiOracle.simulate.setMaxAbsTreasuryPriceIndexRateOfChange([parseEther("100000"), 1], {account: executorAddress}),
    async () => await tpiOracle.simulate.setMinTreasuryPriceIndexTargetTimeDelta([0], {account: executorAddress}),
    async () => {
      await skipForward(3600n);
      const ts = await latestTimestamp();
      return await tpiOracle.simulate.setTreasuryPriceIndexAt([TPI_TARGET, ts + 60], {account: executorAddress})
    },
  ]

  for (const tx of txs) {
    await withTxError(
      async () => {
        const { request } = await tx();

        const txHash = await tclient.writeContract(request);
        ctx.logger.info(`txHash: ${txHash}`);
        const receipt = await tclient.waitForTransactionReceipt({
          hash: txHash,
        });
        console.log(receipt);
      },
      ctx.logger,
    );
  }

  await skipForward(3600n);
  const tpiAfter = await tpiOracle.read.treasuryPriceIndex();
  ctx.logger.info(`TPI After: ${formatEther(tpiAfter)}`);

  return taskSuccess();
}

async function stableGoldAuctionStartAuction(config: Config, ctx: TaskContext) {
    return stableGoldAuctionStart.startAuction(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { auction: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_start_daigold_auction_last_run_time', JB_DATE),
        maxGasPrice: await vars.stablegoldauction_start_auction_max_gas_price.requireValue(ctx),
        checkPeriodMs: await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

async function stableGoldAuctionDistributeGold(config: Config, ctx: TaskContext) {
    return stableGoldAuctionDistributeTgld.distributeGold(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { auction: config.contracts.TEMPLE_GOLD.AUCTIONS.BID_FOR_TGLD, 
        templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD, staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING },
        lastRunTime: kvPersistedValue(ctx, 'daigoldauction_distribute_gold_last_run_time', JB_DATE),
        maxGasPrice: await vars.stablegoldauction_start_auction_max_gas_price.requireValue(ctx),
        checkPeriodMs: await vars.start_stable_gold_auction_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_start_stablegold_auction_last_check_time', JB_DATE),
    });
}

async function stakingDistributeRewards(config: Config, ctx: TaskContext): Promise<TaskResult> {
    return stakingDistributeRewardsa.stakingDistributeRewards(ctx, {
        signerId: config.stakingSignerId,
        chainId: config.chainId,
        contracts: { staking: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_staking_distribute_rewards_last_run_time', JB_DATE),
        maxGasPrice: await vars.staking_distribute_rewards_max_gas_price.requireValue(ctx),
        checkPeriodFinish: true,
        checkPeriodMs:  await vars.staking_distribute_rewards_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_staking_distribute_rewards_last_check_time', JB_DATE),
    });
}

async function burnTempleGold(config: Config, ctx: TaskContext) {
    return burnAndNotify.burnAndUpdateCirculatingSupply(ctx, {
        chainId: config.chainId,
        signerId: config.stableGoldAuctionSignerId,
        contracts: { auctions: getSpiceAuctions(config.contracts),
            templeGold: config.contracts.TEMPLE_GOLD.TEMPLE_GOLD },
        lastRunTime: kvPersistedValue(ctx, 'tgld_burn_tgld_last_run_time', JB_DATE),
        maxGasPrice: await vars.burn_tgld_max_gas_price.requireValue(ctx),
        checkPeriodMs:  await vars.burn_tgld_check_period_ms.requireValue(ctx),
        lastCheckTime: kvPersistedValue(ctx, 'tgld_burn_tgld_last_check_time', JB_DATE),
        mint_source_lz_eid: BigInt(await vars.eth_mainnet_lz_eid.requireValue(ctx)),
        mint_chain_id: BigInt(await vars.mint_chain_id.requireValue(ctx)),
    });
}

main();