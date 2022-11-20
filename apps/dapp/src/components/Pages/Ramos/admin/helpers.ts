import type { AMO__IBalancerVault } from "types/typechain/AMO__IBalancerVault";

export const formatJoinRequestTuple = (request?: AMO__IBalancerVault.JoinPoolRequestStruct): string => {
  if (request) {
    return `[[${request.assets.map((asset) => `"${asset}"`).join(',')}],[${request.maxAmountsIn
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request.userData}",false]`;
  }
  return '';
};