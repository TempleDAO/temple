import { BigRational } from "@mountainpath9/big-rational";
import {
    Logger,
    StringVariable,
    TaskRunner,
} from "@mountainpath9/overlord-core";
import { ActivityType, Client } from "discord.js";
import { Address, getContract, PublicClient } from "viem";
import * as StableGoldAuction from "@/abi/IStableGoldAuction";

//  CONFIG
export const discord_sidebar_bot_token = new StringVariable({
    name: "discord_sidebar_bot_token",
    description: "Token for the sidebar bot. No permissions required.",
    isSecret: true,
});

//  TYPES
type TGLDAuctionState =
    | {
          kind: "auction-in-progress";
          data: {
              currentAuction: {
                  tgldPrice: BigRational;
                  endsAt: Date;
              };
          };
      }
    | {
          kind: "auction-ended";
          data: {
              lastEpoch: {
                  tgldPrice: BigRational;
              };
              nextEpoch: {
                  startsAt: Date;
              };
          };
      };

type TgldAuctionStateGetter = () => Promise<TGLDAuctionState>;

//
export async function startSidebarBot(runner: TaskRunner) {
    const botToken = await runner.config.getString(
        discord_sidebar_bot_token.name()
    );
    if (!botToken) {
        runner.logger.info(`${discord_sidebar_bot_token.name()} not provided`);
        return;
    }
    runner.logger.info(`Starting discord sidebar bot`);
    const bot = new Client({
        intents: [],
    });
    await bot.login(botToken);
    return bot;
}

export async function updateDiscordSidebarBot({
    bot,
    getTgldAuctionState,
    logger,
}: {
    getTgldAuctionState: TgldAuctionStateGetter;
    bot: Client;
    logger: Logger;
}) {
    const stats = await getTgldAuctionState();
    const formattedStats = formatTgldAuctionStats(stats);

    if (!bot.user) {
        logger.error(`No bot user`);
        return;
    }
    await bot.user.setUsername(formattedStats.username);
    bot.user.setPresence({
        activities: [
            {
                name: "TGLD Auction",
                type: ActivityType.Custom,
                url: "https://templedao.link/dapp/spice/earn/auctions",
                state: `${formattedStats.activity}`,
            },
        ],
    });
}

export function formatAuctionTimeDelta(now: Date, futureDate: Date) {
    const msLeft = Math.abs(now.getTime() - futureDate.getTime());

    let delta = "???"; // if >24 h then x days, else {hours}
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const ONE_MINUTE_MS = 60 * 1000;
    if (msLeft > ONE_DAY_MS) {
        delta = `${(msLeft / ONE_DAY_MS).toFixed(1)} days`;
    } else if (msLeft > ONE_HOUR_MS) {
        delta = `${(msLeft / ONE_HOUR_MS).toFixed(1)} hours`;
    } else {
        delta = `${(msLeft / ONE_MINUTE_MS).toFixed(1)} minutes`;
    }
    return delta;
}

function formatTgldPrice(price: BigRational) {
    if (price.lt(BigRational.ONE.div(BigRational.ONE_HUNDRED))) {
        return `<$0.01 / $TGLD`;
    } else {
        return `$${price.toDecimalString(3)} / $TGLD`;
    }
}

function formatTgldAuctionStats(stats: TGLDAuctionState): {
    username: string;
    activity: string;
} {
    const now = new Date();

    switch (stats.kind) {
        case "auction-ended": {
            const startsIn = formatAuctionTimeDelta(
                now,
                stats.data.nextEpoch.startsAt
            );
            return {
                username: formatTgldPrice(stats.data.lastEpoch.tgldPrice),
                activity: `Auction starts in ${startsIn}`,
            };
        }
        case "auction-in-progress": {
            const endsIn = formatAuctionTimeDelta(
                now,
                stats.data.currentAuction.endsAt
            );
            return {
                username: formatTgldPrice(stats.data.currentAuction.tgldPrice),
                activity: `Auction ends in ${endsIn}`,
            };
        }
    }
}

export async function getOnchainTgldAuctionState(
    address: Address,
    client: PublicClient
): Promise<TGLDAuctionState> {
    const auction = getContract({
        address: address,
        abi: StableGoldAuction.ABI,
        client: client
    });
    const currentEpochId = await auction.read.currentEpoch();

    const auctionDetails = async (epochId: bigint) => {
        const {
            totalBidTokenAmount,
            startTime,
            endTime,
            totalAuctionTokenAmount,
        } = await auction.read.getEpochInfo([epochId]);

        const tgldAuctioned = BigRational.fromBigIntWithDecimals(
            totalAuctionTokenAmount,
            18n
        );
        const stablesSpent = BigRational.fromBigIntWithDecimals(
            totalBidTokenAmount,
            18n
        );

        const tgldPrice = tgldAuctioned.eq(BigRational.ZERO)
            ? BigRational.ZERO
            : stablesSpent.div(tgldAuctioned);

        return {
            tgldPrice,
            startsAt: new Date(Number(startTime) * 1000),
            endsAt: new Date(Number(endTime) * 1000),
        };
    };

    const currentAuction = await auctionDetails(currentEpochId);

    if (await auction.read.isCurrentEpochEnded()) {
        // cant use auction.getEpochInfo() for future auctions
        const config = await auction.read.getAuctionConfig();
        const nextAuctionStartTime = new Date(
            currentAuction.endsAt.getTime() +
                Number(config.auctionsTimeDiff + config.auctionStartCooldown) *
                    1000
        );
        return {
            kind: "auction-ended",
            data: {
                lastEpoch: {
                    tgldPrice: currentAuction.tgldPrice,
                },
                nextEpoch: {
                    startsAt: nextAuctionStartTime,
                },
            },
        };
    } else {
        return {
            kind: "auction-in-progress",
            data: {
                currentAuction: {
                    endsAt: currentAuction.endsAt,
                    tgldPrice: currentAuction.tgldPrice,
                },
            },
        };
    }
}
