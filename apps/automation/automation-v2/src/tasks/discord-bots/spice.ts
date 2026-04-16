import { BigRational } from "@mountainpath9/big-rational";
import { Logger, TaskRunner } from "@mountainpath9/overlord-core";
import { Client } from "discord.js";
import { Address, getContract, PublicClient } from "viem";
import * as SpiceAuction from "@/abi/ISpiceAuction";
import * as vars from "@/config/variables";
import {
  SidebarState,
  applyDiscordSidebarState,
  startDiscordSidebarBot,
} from "./runtime";
import { ONE_DAY_MS } from "@/constants";


export interface SpiceAuctionEpoch {
  id: bigint;
  price: BigRational;
  startsAt: Date;
  endsAt: Date;
}

export async function startSpiceSenaSidebarBot(runner: TaskRunner) {
  return startDiscordSidebarBot({
    runner,
    botLabel: "spice sENA sidebar bot",
    tokenVariable: vars.spice_sena_bot_token,
  });
}

export async function updateSpiceSidebarBot({
  bot,
  ticker,
  address,
  client,
  logger,
}: {
  bot: Client;
  ticker: string;
  address: Address;
  client: PublicClient;
  logger: Logger;
}) {
  try {
    logger.info(`Updating ${ticker} spice sidebar bot`);
    const epoch = await getCurrentSpiceAuctionEpoch(address, client);
    await applyDiscordSidebarState({
      bot,
      state: formatSpiceSidebarState(epoch, ticker),
      logger,
    });
  } catch (error) {
    logger.error(
      `Error refreshing ${ticker} spice sidebar bot: ${String(error)}`
    );
    logger.exceptionDetail(error);
    await applyDiscordSidebarState({
      bot,
      state: formatSpiceErrorSidebarState(ticker),
      logger,
    });
    throw error;
  }
}

export function formatSpiceSidebarState(
  epoch: SpiceAuctionEpoch,
  ticker: string,
  now: Date = new Date()
): SidebarState {
  return {
    nickname: `${epoch.price.toDecimalString(4)} ${ticker}`,
    activity: {
      type: "watching",
      name: formatSpiceAuctionActivity(epoch, now),
    },
  };
}

export function formatSpiceAuctionActivity(
  epoch: SpiceAuctionEpoch,
  now: Date = new Date()
) {
  let activity = `Epoch ${epoch.id}`;
  if (epoch.startsAt.getTime() > now.getTime()) {
    activity += ` starts in ${formatDayDelta(now, epoch.startsAt)}`;
  } else if (epoch.endsAt.getTime() > now.getTime()) {
    activity += ` ends in ${formatDayDelta(now, epoch.endsAt)}`;
  } else {
    activity += ` ended ${formatDayDelta(now, epoch.endsAt)} ago`;
  }
  return activity;
}

export function formatSpiceErrorSidebarState(ticker: string): SidebarState {
  return {
    nickname: ticker,
    activity: {
      type: 'watching',
      name: 'ERROR',
    },
  };
}

async function getCurrentSpiceAuctionEpoch(
  address: Address,
  client: PublicClient
): Promise<SpiceAuctionEpoch> {
  const auction = getContract({
    address,
    abi: SpiceAuction.ABI,
    client,
  });

  const currentEpochId = await auction.read.currentEpoch();
  const epoch = await auction.read.getEpochInfo([currentEpochId]);
  const bidTokenAmount = BigRational.fromBigIntWithDecimals(
    epoch.totalBidTokenAmount,
    18n
  );
  const auctionTokenAmount = BigRational.fromBigIntWithDecimals(
    epoch.totalAuctionTokenAmount,
    18n
  );
  const price = auctionTokenAmount.eq(BigRational.ZERO)
    ? BigRational.ZERO
    : bidTokenAmount.div(auctionTokenAmount);

  return {
    id: currentEpochId,
    price,
    startsAt: new Date(Number(epoch.startTime) * 1000),
    endsAt: new Date(Number(epoch.endTime) * 1000),
  };
}

function formatDayDelta(now: Date, targetDate: Date) {
  const days = Math.abs(targetDate.getTime() - now.getTime()) / ONE_DAY_MS;
  return `${days.toFixed(1)} days`;
}
