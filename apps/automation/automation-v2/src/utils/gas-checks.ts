import { BigRational } from "@mountainpath9/big-rational";
import { PublicClient } from "viem";
import { TaskContext } from "@mountainpath9/overlord-core";
import { getMaxGasPriceForChain } from "@/config";

export async function isMaxGasPriceExceeded(ctx: TaskContext, provider: PublicClient, chainId: number): Promise<Boolean> {
    const estimate = await provider.estimateFeesPerGas();
    const gasPrice = BigRational.fromBigIntWithDecimals(estimate.maxFeePerGas || 0n, 9n);
    const maxGasPrice = getMaxGasPriceForChain(chainId);
    if (gasPrice.gt(maxGasPrice)) {
        ctx.logger.info(`skipping due to high gas price (${gasPrice.toDecimalString(0)} > (${maxGasPrice.toDecimalString(0)}`);
        return true;
    }
    return false;
}