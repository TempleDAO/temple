import { ethers } from "ethers";

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 11155111,
        LZ_EID: 40161,
        RESCUER_PLACEHOLDER: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
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
    }
}
