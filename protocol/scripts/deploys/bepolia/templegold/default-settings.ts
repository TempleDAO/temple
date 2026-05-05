import { ethers } from "ethers";

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 80084, // Bepolia (Berachain v2 testnet)
        LZ_EID: 40371,    // Bepolia
        MINT_CHAIN_ID: 11155111, // Sepolia (Minting chain)
        MINT_CHAIN_LZ_EID: 40161, // Sepolia (Minting chain)
        RESCUER_PLACEHOLDER: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
    },
    TEMPLE_GOLD: {
        NAME: "TEMPLE GOLD",
        SYMBOL: "TGLD",
    },
    SPICE: {
        TOKEN_A: {
            NAME: "Spice Token A",
            SYMBOL: "SPICEA",
            INITIAL_MINT: "100000",
        },
        AUCTION: {
            DURATION: 3600 * 24 * 2, // 2 days (standard for Bepolia)
            WAIT_PERIOD: 60,
            MIN_DISTRIBUTED: ethers.utils.parseUnits("1000", 18),
        }
    },
    LAYER_ZERO: {
        ENFORCED_OPTIONS: {
            MSG_TYPE: 1,
            OPTIONS: "0x00030100110100000000000000000000000000030d40"
        }
    }
}
