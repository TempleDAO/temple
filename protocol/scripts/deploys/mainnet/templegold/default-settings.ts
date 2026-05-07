import { ethers } from "ethers";

const ONE_WEEK = 3600 * 24 * 7;

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
            WEEK_MULTIPLIER: ONE_WEEK,
        }
    },
    STAKING: {
        REWARDS_DURATION: ONE_WEEK,
        UNSTAKE_COOLDOWN: ONE_WEEK,
        REWARDS_COOLDOWN: 3600,
    },
    STABLE_GOLD_AUCTION: {
        TIME_DIFF: ONE_WEEK * 2,
        START_COOLDOWN: 0,
        MIN_DISTRIBUTED: ethers.utils.parseEther("10000"),
    },
    SPICE: {
        AUCTION: {
            DURATION: ONE_WEEK,
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
