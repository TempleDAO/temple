import { BigRational } from '@mountainpath9/big-rational';
import { Logger, TaskRunner } from '@mountainpath9/overlord-core';
import { Client } from 'discord.js';
import { Address, getContract, PublicClient } from 'viem';
import * as vars from '@/config/variables';
import * as TreasuryPriceIndexOracle from '@/abi/ITreasuryPriceIndexOracle';
import {
  SidebarState,
  applyDiscordSidebarState,
  startDiscordSidebarBot,
} from './runtime';

interface TemplePriceMetrics {
  spotPrice: number;
  tpi: number;
}

const ONE_INCH_OFFCHAIN_ORACLE =
  '0x00000000000D6FFc74A8feb35aF5827bf57f6786' as Address;
const TEMPLE_TOKEN = '0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7' as Address;
const DAI_TOKEN = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address;
const TPI_ORACLE = '0x6008C7D33bC509A6849D6cf3196F38d693d3Ae6A' as Address;

const TEMPLE_TOKEN_DECIMALS = 18n;
const DAI_TOKEN_DECIMALS = 18n;

export async function startTemplePriceSidebarBot(runner: TaskRunner) {
  return startDiscordSidebarBot({
    runner,
    botLabel: 'TEMPLE price sidebar bot',
    tokenVariable: vars.temple_price_bot_token,
  });
}

export async function updateTemplePriceSidebarBot({
  bot,
  logger,
  client,
}: {
  bot: Client;
  logger: Logger;
  client: PublicClient;
}) {
  try {
    logger.info('Updating TEMPLE price sidebar bot');
    const metrics = await getTemplePriceMetrics(client);
    await applyDiscordSidebarState({
      bot,
      state: formatTemplePriceSidebarState(metrics),
      logger,
    });
  } catch (error) {
    logger.error(`Error refreshing TEMPLE price sidebar bot: ${String(error)}`);
    logger.exceptionDetail(error)
    await applyDiscordSidebarState({
      bot,
      state: formatTemplePriceErrorSidebarState(),
      logger,
    });
  }
}

export function formatTemplePriceSidebarState(
  metrics: TemplePriceMetrics
): SidebarState {
  const premium = computeTemplePricePremium(metrics.spotPrice, metrics.tpi);
  return {
    nickname: `$${formatNumber(metrics.spotPrice, 3)} | ${formatNumber(
      premium,
      2
    )}x TPI`,
    activity: {
      type: 'watching',
      name: `TPI rise: $${formatNumber(metrics.tpi, 4)}`,
    },
  };
}

function formatTemplePriceErrorSidebarState(): SidebarState {
  return {
    nickname: 'ERROR',
    activity: {
      type: 'watching',
      name: `TPI rise: $???`,
    },
  };
}

export function computeTemplePricePremium(spotPrice: number, tpi: number) {
  return spotPrice / tpi;
}

async function getTemplePriceMetrics(
  client: PublicClient
): Promise<TemplePriceMetrics> {
  // https://etherscan.io/address/0x00000000000D6FFc74A8feb35aF5827bf57f6786#readContract#F2
  const offchainOracle = getContract({
    address: ONE_INCH_OFFCHAIN_ORACLE,
    abi: [
      {
        type: 'function',
        name: 'getRate',
        inputs: [
          {
            name: 'srcToken',
            type: 'address',
            internalType: 'contract IERC20',
          },
          {
            name: 'dstToken',
            type: 'address',
            internalType: 'contract IERC20',
          },
          {
            name: 'useWrappers',
            type: 'bool',
            internalType: 'bool',
          },
        ],
        outputs: [
          {
            name: 'weightedRate',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
        stateMutability: 'view',
      },
    ],
    client,
  });
  const tpiOracle = getContract({
    address: TPI_ORACLE,
    abi: TreasuryPriceIndexOracle.ABI,
    client,
  });

  const [weightedRate, treasuryPriceIndex] = await Promise.all([
    offchainOracle.read.getRate([TEMPLE_TOKEN, DAI_TOKEN, true]),
    tpiOracle.read.treasuryPriceIndex(),
  ]);

  const spotPrice = BigRational.fromBigIntWithDecimals(
    weightedRate,
    DAI_TOKEN_DECIMALS
  );
  const tpi = BigRational.fromBigIntWithDecimals(
    treasuryPriceIndex,
    TEMPLE_TOKEN_DECIMALS
  );

  return {
    spotPrice: Number(spotPrice.toDecimalString(18)),
    tpi: Number(tpi.toDecimalString(18)),
  };
}

function formatNumber(value: number, precision: number) {
  return Number(value).toFixed(precision);
}
