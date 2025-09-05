export function etherscanTransactionUrl(chainId: number, txhash: string): string {
    switch (chainId) {
        case 1: return `https://etherscan.io/tx/${txhash}`;
        case 11155111: return `https://sepolia.etherscan.io/tx/${txhash}`;
        case 42161: return `https://arbiscan.io/tx/${txhash}`;
        default: throw new Error(`dont know etherscan url for chain ${chainId}`);
    }
}