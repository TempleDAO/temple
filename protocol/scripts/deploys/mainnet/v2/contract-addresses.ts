import { network } from "hardhat";
import { 
    BalancerPoolHelper, BalancerPoolHelper__factory,
    DsrBaseStrategyTestnet, DsrBaseStrategyTestnet__factory,
    FakeERC20, FakeERC20__factory,
    GnosisStrategy,
    GnosisStrategy__factory,
    LinearWithKinkInterestRateModel, LinearWithKinkInterestRateModel__factory,
    Ramos, Ramos__factory,
    RamosStrategy, RamosStrategy__factory,
    RamosTestnetAuraStaking, RamosTestnetAuraStaking__factory,
    TempleCircuitBreakerAllUsersPerPeriod, TempleCircuitBreakerAllUsersPerPeriod__factory,
    TempleCircuitBreakerProxy, TempleCircuitBreakerProxy__factory,
    TempleDebtToken, TempleDebtToken__factory,
    TempleERC20Token, TempleERC20Token__factory,
    TempleLineOfCredit, TempleLineOfCredit__factory,
    TempleTokenBaseStrategy, TempleTokenBaseStrategy__factory,
    TlcStrategy, TlcStrategy__factory,
    TreasuryPriceIndexOracle, TreasuryPriceIndexOracle__factory,
    TreasuryReservesVault, TreasuryReservesVault__factory 
} from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
    CORE: {
        TEMPLE_TOKEN: string,
        CIRCUIT_BREAKER_PROXY: string,
        // GNOSIS_SAFE_GUARD: string,
        EXECUTOR_MSIG: string,
        RESCUER_MSIG: string,
    },
    TREASURY_RESERVES_VAULT: {
        ADDRESS: string,
        D_USD_TOKEN: string,
        D_TEMPLE_TOKEN: string,
        TPI_ORACLE: string,
    },
    TEMPLE_LINE_OF_CREDIT: {
        ADDRESS: string,
        CIRCUIT_BREAKERS: {
            DAI: string,
            TEMPLE: string,
        },
        INTEREST_RATE_MODELS: {
            LINEAR_WITH_KINK: string,
        },
    },
    RAMOS: {
        AUTOMATION_EOA: string,
        TEMPLE_DAI: {
            ADDRESS: string,
            POOL_HELPER: string,
            AURA_STAKING: string,
            FEE_COLLECTOR: string,
            BPT_TOKEN: string,
            POOL_ID: string,
        },
    }
    STRATEGIES: {
        DSR_BASE_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            // No circuit breakers for DSR base strategy
        }
        TEMPLE_BASE_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            // No circuit breakers for Temple base strategy
        },
        GNOSIS_SAFE_STRATEGY1: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            UNDERLYING_GNOSIS_SAFE: string,
            CIRCUIT_BREAKERS: {
                DAI: string,
                TEMPLE: string,
            },
        },
        RAMOS_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            CIRCUIT_BREAKERS: {
                DAI: string,
                TEMPLE: string,
            },
        },
        TLC_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string
        },
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: string,
            DAI_JOIN: string,
            POT: string,
        },
        BALANCER: {
            VAULT: string,
            HELPERS: string,
        },
    }
}

const V2_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    localhost: {
        CORE: {
            TEMPLE_TOKEN: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
            CIRCUIT_BREAKER_PROXY: '0xE2b5bDE7e80f89975f7229d78aD9259b2723d11F',
            // GNOSIS_SAFE_GUARD: '',
            EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
            RESCUER_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
        },
        TREASURY_RESERVES_VAULT: {
            ADDRESS: '0x4ea0Be853219be8C9cE27200Bdeee36881612FF2',
            D_USD_TOKEN: '0x46d4674578a2daBbD0CEAB0500c6c7867999db34',
            D_TEMPLE_TOKEN: '0x9155497EAE31D432C0b13dBCc0615a37f55a2c87',
            TPI_ORACLE: '0xC6c5Ab5039373b0CBa7d0116d9ba7fb9831C3f42',
        },
        TEMPLE_LINE_OF_CREDIT: {
            ADDRESS: '0x05bB67cB592C1753425192bF8f34b95ca8649f09',
            CIRCUIT_BREAKERS: {
              DAI: '0xa85EffB2658CFd81e0B1AaD4f2364CdBCd89F3a1',
              TEMPLE: '0x8aAC5570d54306Bb395bf2385ad327b7b706016b',
            },
            INTEREST_RATE_MODELS: {
              LINEAR_WITH_KINK: '0x38628490c3043E5D0bbB26d5a0a62fC77342e9d5',
            },
        },
        RAMOS: {
            AUTOMATION_EOA: '',
            TEMPLE_DAI: {
                ADDRESS: '',
                POOL_HELPER: '',
                AURA_STAKING: '',
                FEE_COLLECTOR: '',
                BPT_TOKEN: '',
                POOL_ID: '',
            },
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: '0xfB12F7170FF298CDed84C793dAb9aBBEcc01E798',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: '0xc1EeD9232A0A44c2463ACB83698c162966FBc78d',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                // No circuit breakers for Temple base strategy
            },
            GNOSIS_SAFE_STRATEGY1: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                UNDERLYING_GNOSIS_SAFE: '',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            RAMOS_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            TLC_STRATEGY: {
                ADDRESS: '0x64f5219563e28EeBAAd91Ca8D31fa3b36621FD4f',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                DAI_JOIN: '0x9759A6Ac90977b93B58547b4A71c78317f391A28',
                POT: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7',
            },
            BALANCER: {
                VAULT: '',
                HELPERS: '',
            },
        },
    },
    mainnet: {
        CORE: {
            TEMPLE_TOKEN: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
            CIRCUIT_BREAKER_PROXY: '',
            // GNOSIS_SAFE_GUARD: '',
            EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
            RESCUER_MSIG: '',
        },
        TREASURY_RESERVES_VAULT: {
            ADDRESS: '',
            D_USD_TOKEN: '',
            D_TEMPLE_TOKEN: '',
            TPI_ORACLE: '',
        },
        TEMPLE_LINE_OF_CREDIT: {
            ADDRESS: '',
            CIRCUIT_BREAKERS: {
              DAI: '',
              TEMPLE: '',
            },
            INTEREST_RATE_MODELS: {
              LINEAR_WITH_KINK: '',
            },
        },
        RAMOS: {
            AUTOMATION_EOA: '',
            TEMPLE_DAI: {
                ADDRESS: '',
                POOL_HELPER: '',
                AURA_STAKING: '',
                FEE_COLLECTOR: '',
                BPT_TOKEN: '',
                POOL_ID: '',
            },
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '',
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '',
                // No circuit breakers for Temple base strategy
            },
            GNOSIS_SAFE_STRATEGY1: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '',
                UNDERLYING_GNOSIS_SAFE: '',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            RAMOS_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            TLC_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '',
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                DAI_JOIN: '0x9759A6Ac90977b93B58547b4A71c78317f391A28',
                POT: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7',
            },
            BALANCER: {
                VAULT: '',
                HELPERS: '',
            },
        },
    },
}

export function getDeployedContracts(): ContractAddresses {
    if (V2_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return V2_DEPLOYED_CONTRACTS[network.name];
    }
}

export interface ContractInstances {
    CORE: {
        TEMPLE_TOKEN: TempleERC20Token,
        CIRCUIT_BREAKER_PROXY: TempleCircuitBreakerProxy,
    },
    TREASURY_RESERVES_VAULT: {
        INSTANCE: TreasuryReservesVault,
        D_USD_TOKEN: TempleDebtToken,
        D_TEMPLE_TOKEN: TempleDebtToken,
        TPI_ORACLE: TreasuryPriceIndexOracle,
    },
    TEMPLE_LINE_OF_CREDIT: {
        INSTANCE: TempleLineOfCredit,
        CIRCUIT_BREAKERS: {
            DAI: TempleCircuitBreakerAllUsersPerPeriod,
            TEMPLE: TempleCircuitBreakerAllUsersPerPeriod,
        },
        INTEREST_RATE_MODELS: {
            LINEAR_WITH_KINK: LinearWithKinkInterestRateModel,
        },
    },
    RAMOS: {
        TEMPLE_DAI: {
            INSTANCE: Ramos,
            POOL_HELPER: BalancerPoolHelper,
            AURA_STAKING: RamosTestnetAuraStaking,
        }
    },
    STRATEGIES: {
        DSR_BASE_STRATEGY: {
            INSTANCE: DsrBaseStrategyTestnet,
        }
        TEMPLE_BASE_STRATEGY: {
            INSTANCE: TempleTokenBaseStrategy,
        },
        RAMOS_STRATEGY: {
            INSTANCE: RamosStrategy,
            CIRCUIT_BREAKERS: {
                DAI: TempleCircuitBreakerAllUsersPerPeriod,
                TEMPLE: TempleCircuitBreakerAllUsersPerPeriod,
            },
        },
        TLC_STRATEGY: {
            INSTANCE: TlcStrategy,
        },
        GNOSIS_SAFE_STRATEGY1: {
            INSTANCE: GnosisStrategy,
            CIRCUIT_BREAKERS: {
                DAI: TempleCircuitBreakerAllUsersPerPeriod,
                TEMPLE: TempleCircuitBreakerAllUsersPerPeriod,
            },
        },
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
    },
}

export function connectToContracts(owner: Signer): ContractInstances {
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();

    return {
        CORE: {
            TEMPLE_TOKEN: TempleERC20Token__factory.connect(TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
            CIRCUIT_BREAKER_PROXY: TempleCircuitBreakerProxy__factory.connect(TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY, owner),
        },
        TREASURY_RESERVES_VAULT: {
            INSTANCE: TreasuryReservesVault__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS, owner),
            D_USD_TOKEN: TempleDebtToken__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.D_USD_TOKEN, owner),
            D_TEMPLE_TOKEN: TempleDebtToken__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN, owner),
            TPI_ORACLE: TreasuryPriceIndexOracle__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.TPI_ORACLE, owner),
        },
        TEMPLE_LINE_OF_CREDIT: {
            INSTANCE: TempleLineOfCredit__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, owner),
            CIRCUIT_BREAKERS: {
                DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI, owner),
                TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE, owner),
            },
            INTEREST_RATE_MODELS: {
                LINEAR_WITH_KINK: LinearWithKinkInterestRateModel__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK, owner),
            },
        },
        RAMOS: {
            TEMPLE_DAI: {
                INSTANCE: Ramos__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.ADDRESS, owner),
                POOL_HELPER: BalancerPoolHelper__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.POOL_HELPER, owner),
                AURA_STAKING: RamosTestnetAuraStaking__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.AURA_STAKING, owner),
            }
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                INSTANCE: DsrBaseStrategyTestnet__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS, owner),
            },
            TEMPLE_BASE_STRATEGY: {
                INSTANCE: TempleTokenBaseStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS, owner),
            },
            RAMOS_STRATEGY: {
                INSTANCE: RamosStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.ADDRESS, owner),
                CIRCUIT_BREAKERS: {
                    DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.DAI, owner),
                    TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE, owner),
                },
            },
            TLC_STRATEGY: {
                INSTANCE: TlcStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.ADDRESS, owner),
            },
            GNOSIS_SAFE_STRATEGY1: {
                INSTANCE: GnosisStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.ADDRESS, owner),
                CIRCUIT_BREAKERS: {
                    DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.CIRCUIT_BREAKERS.DAI, owner),
                    TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.CIRCUIT_BREAKERS.TEMPLE, owner),
                },
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
        }
    }
}