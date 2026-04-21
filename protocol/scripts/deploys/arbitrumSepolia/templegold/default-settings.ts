import { ethers } from "ethers";

export const DEFAULT_SETTINGS = {
    GLOBAL: {
        CHAIN_ID: 421614, // Arbitrum Sepolia
        LZ_EID: 40231,    // Arbitrum Sepolia
        MINT_CHAIN_ID: 11155111, // Sepolia (Minting chain)
        MINT_CHAIN_LZ_EID: 40161, // Sepolia (Minting chain)
        RESCUER_PLACEHOLDER: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    },
    TEMPLE_GOLD: {
        NAME: "TEMPLE GOLD",
        SYMBOL: "TGLD",
        DISTRIBUTION: {
            STAKING: ethers.utils.parseEther("20"),
            AUCTION: ethers.utils.parseEther("70"),
            GNOSIS: ethers.utils.parseEther("10"),
        },
        VESTING: {
            VALUE: 35,
            WEEK_MULTIPLIER: 3600 * 24 * 7,
        }
    },
    TEMPLE_TOKEN: {
        NAME: "Temple Token",
        SYMBOL: "TEMPLE",
        INITIAL_MINT: "100000",
    },
    STAKING: {
        REWARDS_DURATION: 3600 * 24 * 7,
        UNSTAKE_COOLDOWN: 3600 * 24,
        REWARDS_COOLDOWN: 2 * 3600,
    },
    STABLE_GOLD_AUCTION: {
        TIME_DIFF: 3600 * 24,
        START_COOLDOWN: 60,
        MIN_DISTRIBUTED: ethers.utils.parseEther("10"),
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
            RECIPIENT: "0xC785695710292c042a2de8A0Ba16F3a054cC2eAD"
        }
    },
    LAYER_ZERO: {
        ENFORCED_OPTIONS: {
            MSG_TYPE: 1,
            OPTIONS: "0x00030100110100000000000000000000000000030d40"
        }
    }
}
