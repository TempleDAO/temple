import { TaskContext } from "@mountainpath9/overlord-core";
import { JsonRpcProvider, Provider } from "ethers";

export async function getMevProtectedProvider(ctx: TaskContext, chainId: number): Promise<Provider> {
    const configKey = `mev_protected_provider_url_${chainId}`;
    const rpcUrl = await ctx.config.requireString(configKey);

    // Flashbots doesn't support batch JsonRpc requests
    let batchMaxCount: number | undefined;
    if (rpcUrl.includes("flashbots")) {
        batchMaxCount = 1;
    }
    return new JsonRpcProvider(rpcUrl, chainId, {
        staticNetwork: true,
        batchMaxCount
    });
}