import { ethers } from "ethers";

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 80094, // Berachain
        LZ_EID: 30262,    // Berachain
        MINT_CHAIN_ID: 1, // Mainnet (Minting chain)
        MINT_CHAIN_LZ_EID: 30101, // Mainnet (Minting chain)
    },
    TEMPLE_GOLD: {
        NAME: "TEMPLE GOLD",
        SYMBOL: "TGLD",
    },
    SPICE: {
        AUCTION: {
            DURATION: 3600 * 24 * 7, // 7 days
            WAIT_PERIOD: 3600,
            MIN_DISTRIBUTED: ethers.utils.parseUnits("1", 18),
        }
    },
    LAYER_ZERO: {
        ENFORCED_OPTIONS: {
            MSG_TYPE: 1,
            OPTIONS: "0x00030100110100000000000000000000000000030d40"
        }
    }
}
