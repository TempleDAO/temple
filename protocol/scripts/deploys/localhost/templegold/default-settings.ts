import { ethers } from "ethers";

const ONE_DAY = 3600 * 24;
const ONE_WEEK = ONE_DAY * 7;

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 1, // Mainnet fork
        LZ_EID: 30101, // Mainnet
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
            VALUE: 35,
            WEEK_MULTIPLIER: ONE_WEEK,
        }
    },
    STAKING: {
        REWARDS_DURATION: ONE_WEEK,
        UNSTAKE_COOLDOWN: ONE_DAY,
        REWARDS_COOLDOWN: 60,
    },
    STABLE_GOLD_AUCTION: {
        TIME_DIFF: 60,
        START_COOLDOWN: 60,
        MIN_DISTRIBUTED: ethers.utils.parseEther("0.01"),
    },
    SPICE: {
        AUCTION: {
            DURATION: ONE_WEEK,
            WAIT_PERIOD: 60,
            MIN_DISTRIBUTED: 10_000,
        }
    },
    LAYER_ZERO: {
        ENFORCED_OPTIONS: {
            MSG_TYPE: 1,
            OPTIONS: "0x00030100110100000000000000000000000000030d40"
        }
    },
    LOCALHOST: {
        TEAM_GNOSIS: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Anvil signer 0
        SPICE_AUCTION: "0xBd90822a325c234881C0197B15e3f391f26F79Ef",
    }
}
