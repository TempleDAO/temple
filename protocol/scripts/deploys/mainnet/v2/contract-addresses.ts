import { network } from "hardhat";
import { 
    AuraStaking,AuraStaking__factory,
    BalancerPoolHelper, BalancerPoolHelper__factory,
    DsrBaseStrategyTestnet, DsrBaseStrategyTestnet__factory,
    FakeERC20, FakeERC20__factory,
    GnosisStrategy,
    GnosisStrategy__factory,
    LinearWithKinkInterestRateModel, LinearWithKinkInterestRateModel__factory,
    Ramos, Ramos__factory,
    RamosStrategy, RamosStrategy__factory,
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
        GNOSIS_SAFE_GUARD: string,
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
            EXTERNAL: {
              BALANCER_LP_TOKEN: string,
              BALANCER_POOL_ID: string,
              AURA_POOL_ID: string,
              AURA_REWARDS: string,
              AURA_STAKING_DEPOSIT_TOKEN: string,
            }
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
        GNOSIS_SAFE_STRATEGY_TEMPLATE: {
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
            BAL_TOKEN: string,
        },
        AURA: {
          AURA_TOKEN: string,
          AURA_BOOSTER: string,
        },
    }
}

const V2_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    localhost: {
        CORE: {
            TEMPLE_TOKEN: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
            CIRCUIT_BREAKER_PROXY: '0xE2b5bDE7e80f89975f7229d78aD9259b2723d11F',
            GNOSIS_SAFE_GUARD: '0xC220Ed128102d888af857d137a54b9B7573A41b2',
            EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
             // Uses the treasury msig for local fork testing
            RESCUER_MSIG: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
        },
        TREASURY_RESERVES_VAULT: {
            ADDRESS: '0x4ea0Be853219be8C9cE27200Bdeee36881612FF2',
            D_USD_TOKEN: '0x46d4674578a2daBbD0CEAB0500c6c7867999db34',
            D_TEMPLE_TOKEN: '0x9155497EAE31D432C0b13dBCc0615a37f55a2c87',
            TPI_ORACLE: '0xC6c5Ab5039373b0CBa7d0116d9ba7fb9831C3f42',
        },
        TEMPLE_LINE_OF_CREDIT: {
            ADDRESS: '0xa85EffB2658CFd81e0B1AaD4f2364CdBCd89F3a1',
            CIRCUIT_BREAKERS: {
              DAI: '0x8aAC5570d54306Bb395bf2385ad327b7b706016b',
              TEMPLE: '0x64f5219563e28EeBAAd91Ca8D31fa3b36621FD4f',
            },
            INTEREST_RATE_MODELS: {
              LINEAR_WITH_KINK: '0x05bB67cB592C1753425192bF8f34b95ca8649f09',
            },
        },
        RAMOS: {
            AUTOMATION_EOA: '0x67ae2161449cf3c5528fea969beba3e4f3288c61',
            TEMPLE_DAI: {
                ADDRESS: '0xbFD3c8A956AFB7a9754C951D03C9aDdA7EC5d638',
                POOL_HELPER: '0x38F6F2caE52217101D7CA2a5eC040014b4164E6C',
                AURA_STAKING: '0xde79380FBd39e08150adAA5C6c9dE3146f53029e',
                FEE_COLLECTOR: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                EXTERNAL: {
                  BALANCER_LP_TOKEN: '0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba0',
                  BALANCER_POOL_ID: '0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba00002000000000000000004ed',
                  AURA_POOL_ID: '79',
                  AURA_REWARDS: '0x13544617b10e1923363c89d902b749bea331ac4e',
                  AURA_STAKING_DEPOSIT_TOKEN: '0x0B7C71d61D960F70d89ecaC55DC2B4c1A7b508ee',
                },
            },
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: '0xfB12F7170FF298CDed84C793dAb9aBBEcc01E798',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: '0xc1EeD9232A0A44c2463ACB83698c162966FBc78d',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
            },
            GNOSIS_SAFE_STRATEGY_TEMPLATE: {
                ADDRESS: '',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
                UNDERLYING_GNOSIS_SAFE: '',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            RAMOS_STRATEGY: {
                ADDRESS: '0x04d7478fDF318C3C22cECE62Da9D78ff94807D77',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
                CIRCUIT_BREAKERS: {
                    DAI: '0xc075BC0f734EFE6ceD866324fc2A9DBe1065CBB1',
                    TEMPLE: '0x837a41023CF81234f89F956C94D676918b4791c1',
                },
            },
            TLC_STRATEGY: {
                ADDRESS: '0x1757a98c1333B9dc8D408b194B2279b5AFDF70Cc',
                EXECUTOR_MSIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
                RESCUER_MSIG: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                DAI_JOIN: '0x9759A6Ac90977b93B58547b4A71c78317f391A28',
                POT: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7',
            },
            BALANCER: {
                VAULT: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
                HELPERS: '0x5aDDCCa35b7A0D07C74063c48700C8590E87864E',
                BAL_TOKEN: '0xba100000625a3754423978a60c9317c58a424e3D',
            },
            AURA: {
              AURA_TOKEN: '0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF',
              AURA_BOOSTER: '0xA57b8d98dAE62B26Ec3bcC4a365338157060B234',
          },
        },
    },
    mainnet: {
        CORE: {
            TEMPLE_TOKEN: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
            CIRCUIT_BREAKER_PROXY: '',
            GNOSIS_SAFE_GUARD: '',
            EXECUTOR_MSIG: '',
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
            AUTOMATION_EOA: '0x67ae2161449cf3c5528fea969beba3e4f3288c61',
            TEMPLE_DAI: {
                ADDRESS: '',
                POOL_HELPER: '',
                AURA_STAKING: '',
                FEE_COLLECTOR: '',
                EXTERNAL: {
                  BALANCER_LP_TOKEN: '0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba0',
                  BALANCER_POOL_ID: '0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba00002000000000000000004ed',
                  AURA_POOL_ID: '79',
                  AURA_REWARDS: '0x13544617b10e1923363c89d902b749bea331ac4e',
                  AURA_STAKING_DEPOSIT_TOKEN: '0x0B7C71d61D960F70d89ecaC55DC2B4c1A7b508ee',
                },
            },
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '',
                RESCUER_MSIG: '',
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '',
                RESCUER_MSIG: '',
            },
            GNOSIS_SAFE_STRATEGY_TEMPLATE: {
                ADDRESS: '',
                EXECUTOR_MSIG: '',
                RESCUER_MSIG: '',
                UNDERLYING_GNOSIS_SAFE: '',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            RAMOS_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '',
                RESCUER_MSIG: '',
                CIRCUIT_BREAKERS: {
                    DAI: '',
                    TEMPLE: '',
                },
            },
            TLC_STRATEGY: {
                ADDRESS: '',
                EXECUTOR_MSIG: '',
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
                VAULT: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
                HELPERS: '0x5aDDCCa35b7A0D07C74063c48700C8590E87864E',
                BAL_TOKEN: '0xba100000625a3754423978a60c9317c58a424e3D',
            },
            AURA: {
              AURA_TOKEN: '0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF',
              AURA_BOOSTER: '0xA57b8d98dAE62B26Ec3bcC4a365338157060B234',
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
        GNOSIS_SAFE_GUARD: GnosisStrategy,
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
            AURA_STAKING: AuraStaking,
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
        // This is not yet needed - but when we have a first gnosis strategy
        // this can be used as the template.
        GNOSIS_SAFE_STRATEGY_TEMPLATE: {
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
            GNOSIS_SAFE_GUARD: GnosisStrategy__factory.connect(TEMPLE_V2_ADDRESSES.CORE.GNOSIS_SAFE_GUARD, owner),
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
                AURA_STAKING: AuraStaking__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.AURA_STAKING, owner),
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
            GNOSIS_SAFE_STRATEGY_TEMPLATE: {
                INSTANCE: GnosisStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.ADDRESS, owner),
                CIRCUIT_BREAKERS: {
                    DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.DAI, owner),
                    TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.TEMPLE, owner),
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