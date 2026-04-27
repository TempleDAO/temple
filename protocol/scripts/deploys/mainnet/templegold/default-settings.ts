import { ethers } from "ethers";

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 1, // Mainnet
        LZ_EID: 30101,    // Mainnet
    },
    TEMPLE_GOLD: {
        NAME: "TEMPLE GOLD",
        SYMBOL: "TGLD",
        DISTRIBUTION: {
            STAKING: ethers.utils.parseEther("15"),
            AUCTION: ethers.utils.parseEther("70"),
            GNOSIS: ethers.utils.parseEther("15"),
        },
        VESTING: {
            VALUE: 156,
            WEEK_MULTIPLIER: 3600 * 24 * 7,
        }
    },
    STAKING: {
        REWARDS_DURATION: 3600 * 24 * 7,
        UNSTAKE_COOLDOWN: 3600 * 24 * 7,
        REWARDS_COOLDOWN: 3600,
    },
    STABLE_GOLD_AUCTION: {
        TIME_DIFF: 3600 * 24 * 7 * 2,
        START_COOLDOWN: 0,
        MIN_DISTRIBUTED: ethers.utils.parseEther("10000"),
    },
    SPICE: {
        AUCTION: {
            DURATION: 3600 * 24 * 7,
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
