import {
    FakeERC20,
    TempleGold,
    TempleGoldAdmin,
    TempleGoldStaking,
    SpiceAuctionFactory,
    StableGoldAuction,
    TempleTeleporter,
    TempleERC20Token
} from '../../../typechain';

export interface BaseContractAddresses {
    TEMPLE_GOLD: {
        AUCTION_AUTOMATION_EOA: string,
        STAKING_AUTOMATION_EOA: string,
        SPICE_AUCTION_OPERATOR: string,
        TEMPLE_GOLD: string,
        TEMPLE_GOLD_ADMIN: string,
        TEMPLE_GOLD_STAKING: string,
        TEMPLE_TELEPORTER: string,
        SPICE_AUCTION_FACTORY: string,
        STABLE_GOLD_AUCTION: string,
        TEAM_GNOSIS: string,
        SPICE_AUCTION_IMPLEMENTATION: string,
        STRATEGY_GNOSIS: string,
    },
    CORE: {
        TEMPLE_TOKEN: string,
        EXECUTOR_MSIG: string,
        RESCUER_MSIG: string,
    },
    EXTERNAL: {
        LAYER_ZERO: {
            ENDPOINT: string,
        },
        MAKER_DAO: {
            DAI_TOKEN: string,
        },
        SKY: {
            USDS: string,
        }
    }
    SPICE_AUCTIONS: {
        SPICE_TGLD: string,
        DAI_TGLD: string,
        ENA_TGLD: string,
        SENA_TGLD: string,
    }
}

export interface BaseContractInstances {
    TEMPLE_GOLD: {
        TEMPLE_GOLD: TempleGold,
        TEMPLE_GOLD_ADMIN: TempleGoldAdmin,
        TEMPLE_GOLD_STAKING: TempleGoldStaking,
        TEMPLE_TELEPORTER: TempleTeleporter,
        SPICE_AUCTION_FACTORY: SpiceAuctionFactory,
        STABLE_GOLD_AUCTION: StableGoldAuction,
    },
    CORE: {
        TEMPLE_TOKEN: TempleERC20Token
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
    },
}

export type ContractAddresses = BaseContractAddresses;
export type ContractInstances = BaseContractInstances;
