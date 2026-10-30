import { ethers } from "ethers";

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 11155111,
        LZ_EID: 40161,
        RESCUER_PLACEHOLDER: "0x57a57d976f73479f20B3Be7FE6ea20A23495b2F8",
    },
    TEMPLE_GOLD: {
        NAME: "TEMPLE GOLD",
        SYMBOL: "TGLD",
    },
    TEMPLE_TOKEN: {
        NAME: "Temple Token",
        SYMBOL: "TEMPLE",
        INITIAL_MINT: "100000",
    },
    SPICE: {
        TOKEN_A: {
            NAME: "Spice Token A",
            SYMBOL: "SPICEA",
            INITIAL_MINT: "100000",
        },
        AUCTION: {
            DURATION: 3600 * 24 * 7,
            WAIT_PERIOD: 60,
            MIN_DISTRIBUTED: ethers.utils.parseUnits("1000", 18),
        }
    },
    LAYER_ZERO: {
        ENFORCED_OPTIONS: {
            MSG_TYPE: 1,
            OPTIONS: "0x00030100110100000000000000000000000000030d40"
        }
    },
    GRANARY: {
        RESCUER: "0x7Ab8375c4F1167b92a1fD649Bc2f5e8E6aa7d4c4",
        FLAGGER: "0xC785695710292c042a2de8A0Ba16F3a054cC2eAD",
        AUCTION: {
            // Buffer above the on-chain one-day minimum for transaction inclusion.
            START_DELAY: 3600 * 25,
            DEPOSIT_DURATION: 3600 * 24,
            FULFILLMENT_DURATION: 3600 * 24,
            PRICE: ethers.utils.parseUnits("4", 18),
            MIN_DEPOSIT: ethers.utils.parseUnits("1", 18),
        },
    }
}
