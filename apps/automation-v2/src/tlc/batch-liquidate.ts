import { Chain } from "@/chains";
import { DISCORD_WEBHOOK_URL_KEY, connectDiscord } from "@/common/discord";
import { TempleTaskDiscordEvent, TempleTaskDiscordMetadata, buildTempleTasksDiscordMessage, formatBigNumber, matchAndDecodeEvent } from "@/common/utils";
import { ITempleLineOfCredit, ITempleLineOfCredit__factory } from "@/typechain";
import { BigNumber } from "@ethersproject/bignumber";
import { formatUnits } from "@ethersproject/units";
import { TaskContext, TaskResult, taskSuccess } from "@mountainpath9/overlord";

export interface TlcBatchLiquidateConfig {
    CHAIN: Chain,
    WALLET_NAME: string,
    TLC_ADDRESS: string,
}

/** number from attos (ie, human readable) */
export function fromAtto(n: BigNumber): number {
    return Number.parseFloat(formatUnits(n, 18));
  }

const accTest = "0x71e41D0dFeA7ca196c7B104F01EfFd1102af9694";
  
export async function batchLiquidate(
    ctx: TaskContext,
    config: TlcBatchLiquidateConfig,
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

    const checkAccPosition = async () =>  {
        console.log();
        console.log("**Acc to check %s **", accTest);
        const position = await tlc.accountPosition(accTest);
        console.log("\t-collateral:       ", fromAtto(position.collateral));
        console.log("\t-currentDebt:      ", fromAtto(position.currentDebt));
        console.log("\t-maxBorrow:        ", fromAtto(position.maxBorrow));
        console.log("\t-healthFactor:     ", fromAtto(position.healthFactor));
        console.log("\t-loanToValueRatio: ", fromAtto(position.loanToValueRatio));
        console.log();
    }

    const accountsToCheck = [accTest];

    const submittedAt = new Date();
    const status = await tlc.computeLiquidity(accountsToCheck);
    console.log('hasExceeded ltv: ', status[0][0]);
    checkAccPosition();
    const tx = await tlc.batchLiquidate(accountsToCheck);
    checkAccPosition();
    const txReceipt = await tx.wait();
    const txUrl = config.CHAIN.transactionUrl(txReceipt.transactionHash);
    // Grab the events
    const events: TempleTaskDiscordEvent[] = [];
    for (const ev of txReceipt?.events || []) {
        const liquidatedEv = matchAndDecodeEvent(tlc, tlc.filters.Liquidated(), ev);
        if (liquidatedEv) {
            events.push({
                what: "Liquidated",
                details: [
                    `account = \`${liquidatedEv.account}\``,
                    `collateralValue = \`${formatBigNumber(liquidatedEv.collateralValue, 18, 4)}\``,
                    `collateralSeized = \`${formatBigNumber(liquidatedEv.collateralSeized, 18, 4)}\``,
                    `daiDebtWiped = \`${formatBigNumber(liquidatedEv.daiDebtWiped, 18, 4)}\``,
                ]
            })
        }
    }
    const metadata: TempleTaskDiscordMetadata = {
        title: 'TLC Batch Liquidate',
        events,
        submittedAt,
        txReceipt,
        txUrl
    };

    // Send notification
    const message = await buildTempleTasksDiscordMessage(provider, config.CHAIN, metadata);
    const webhookUrl = await ctx.getSecret(DISCORD_WEBHOOK_URL_KEY);
    const discord = await connectDiscord(webhookUrl, ctx.logger);
    await discord.postMessage(message);

    return taskSuccess();
}