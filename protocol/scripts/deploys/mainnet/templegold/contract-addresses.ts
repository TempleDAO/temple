import { network } from "hardhat";
import {
    FakeERC20, FakeERC20__factory,
    TempleGold__factory, TempleGold,
    TempleGoldAdmin, TempleGoldAdmin__factory,
    TempleGoldStaking, TempleGoldStaking__factory,
    SpiceAuction__factory, SpiceAuction,
    SpiceAuctionFactory__factory, SpiceAuctionFactory,
    StableGoldAuction__factory, StableGoldAuction,
    TempleTeleporter, TempleTeleporter__factory,
    TempleERC20Token, TempleERC20Token__factory
} from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
    TEMPLE_GOLD: {
        AUCTION_AUTOMATION_EOA: string,
        STAKING_AUTOMATION_EOA: string,
        SPICE_AUCTION_OPERATOR: string,
        TEMPLE_GOLD: string,
        TEMPLE_GOLD_ADMIN: string,
        TEMPLE_GOLD_STAKING: string,
        TEMPLE_TELEPORTER: string,
        SPICE_AUCTION: string,
        SPICE_AUCTION_FACTORY: string,
        STABLE_GOLD_AUCTION: string,
        TEAM_GNOSIS: string,
        SPICE_AUCTION_IMPLEMENTATION: string,
        STRATEGY_GNOSIS: string,
        SPICE_TOKEN: string,
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
    }
}

export const TEMPLEGOLD_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    berachain: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0x",
            STAKING_AUTOMATION_EOA: "0x",
            SPICE_AUCTION_OPERATOR: "0x",
            TEMPLE_GOLD: "0x",
            TEMPLE_GOLD_ADMIN: "0x",
            TEMPLE_GOLD_STAKING: "0x",
            TEMPLE_TELEPORTER: "0x",
            SPICE_AUCTION: "0x",
            SPICE_AUCTION_FACTORY: "0x",
            STABLE_GOLD_AUCTION: "0x",
            TEAM_GNOSIS: "0x",
            SPICE_AUCTION_IMPLEMENTATION: "0x",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x",
        },
        CORE: {
            TEMPLE_TOKEN: "0x",
            EXECUTOR_MSIG: "0x94b62A27a2f23CBdc0220826a8452fB5055cF273",
            RESCUER_MSIG: "0x",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x",
            },
            SKY: {
                USDS: "0x",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x",
            DAI_TGLD: "0x",
        },
    },
    bepolia: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0x",
            STAKING_AUTOMATION_EOA: "0x",
            SPICE_AUCTION_OPERATOR: "0x",
            TEMPLE_GOLD: "0x20ceB4504a9e7eda0491ab6356A5EfC419002df9",
            TEMPLE_GOLD_ADMIN: "0x",
            TEMPLE_GOLD_STAKING: "0x",
            TEMPLE_TELEPORTER: "0x",
            SPICE_AUCTION: "0x",
            SPICE_AUCTION_FACTORY: "0xD5e60Dbc43A76EaB01bdC3d320d8e4bbAc3b9191",
            STABLE_GOLD_AUCTION: "0x",
            TEAM_GNOSIS: "0x",
            SPICE_AUCTION_IMPLEMENTATION: "0xCb9d6d71aFBC09964577EE400d3E5a92fbAabaA0",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x21F980E0B3b484eB361626e0098AA9741A1221cb",
        },
        CORE: {
            TEMPLE_TOKEN: "0x",
            EXECUTOR_MSIG: "0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd",
            RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x",
            },
            SKY: {
                USDS: "0x",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x72D7C9c5E0A187A06E4D1508ceA77dE17db07953",
            DAI_TGLD: "0x",
        },
    },
    arbitrumOne: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0x",
            STAKING_AUTOMATION_EOA: "0x",
            SPICE_AUCTION_OPERATOR: "0x",
            TEMPLE_GOLD: "0x",
            TEMPLE_GOLD_ADMIN: "0x",
            TEMPLE_GOLD_STAKING: "0x",
            TEMPLE_TELEPORTER: "0x",
            SPICE_AUCTION: "0x",
            SPICE_AUCTION_FACTORY: "0x",
            STABLE_GOLD_AUCTION: "0x",
            TEAM_GNOSIS: "0x",
            SPICE_AUCTION_IMPLEMENTATION: "0x",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x",
        },
        CORE: {
            TEMPLE_TOKEN: "0x",
            EXECUTOR_MSIG: "0x",
            RESCUER_MSIG: "0x",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x",
            },
            SKY: {
                USDS: "0x",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x",
            DAI_TGLD: "0x",
        },
    },
    mainnet: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0x",
            STAKING_AUTOMATION_EOA: "0x",
            SPICE_AUCTION_OPERATOR: "0x",
            TEMPLE_GOLD: "0x0E7B53dDe30754A94D4B10C9CdCaCA1C749ECd1b",
            TEMPLE_GOLD_ADMIN: "0xA03c542dD631b6aFbE6144f9F8304c8B30a55548",
            TEMPLE_GOLD_STAKING: "0x64866d080CfEf0e45A3a64A558dA6eEAD7542657",
            TEMPLE_TELEPORTER: "0x",
            SPICE_AUCTION: "0x",
            SPICE_AUCTION_FACTORY: "0x",
            STABLE_GOLD_AUCTION: "0x0bC14503c467CB675b6B30da05Dbed80C83d154e",
            TEAM_GNOSIS: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",
            SPICE_AUCTION_IMPLEMENTATION: "0x",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x",
        },
        CORE: {
            TEMPLE_TOKEN: "0x",
            EXECUTOR_MSIG: "0x94b62A27a2f23CBdc0220826a8452fB5055cF273",
            RESCUER_MSIG: "0x",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            },
            SKY: {
                USDS: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x",
            DAI_TGLD: "0x",
        },
    },
    sepolia: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0x",
            STAKING_AUTOMATION_EOA: "0x",
            SPICE_AUCTION_OPERATOR: "0x",
            TEMPLE_GOLD: "0x2ae6318e34bb97ae3755AFcE75559452aA223A5D",
            TEMPLE_GOLD_ADMIN: "0x",
            TEMPLE_GOLD_STAKING: "0x36061ce3Ac2F5d69667F0c7B98Ec6021ef33b8cB",
            TEMPLE_TELEPORTER: "0x7De0066A6BD454B2Ecaeb3E54814458a71D345A5",
            SPICE_AUCTION: "0xA52D686d250F62e6b4Bc31dD17ad18f94c6cA56D",
            SPICE_AUCTION_FACTORY: "0x3c84E8848C2D78107630c367500d79E8E6975be4",
            STABLE_GOLD_AUCTION: "0x8d3671d794d511Bb0E3D28e260F8E2233C0653aB",
            TEAM_GNOSIS: "0x",
            SPICE_AUCTION_IMPLEMENTATION: "0xC8E5D9B2f53Ae2180bf39F2738c9c9F4cE713138",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x",
        },
        CORE: {
            TEMPLE_TOKEN: "0x98c5E61b1B3731A1f379E8770861164d23118cdc",
            EXECUTOR_MSIG: "0x",
            RESCUER_MSIG: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6EDCE65403992e310A62460808c4b910D972f10f",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0xBe9162230D9e637218D74C7f41f62ef2385fEe64",
            },
            SKY: {
                USDS: "0x",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x",
            DAI_TGLD: "0x",
        },
    },
    arbitrumSepolia: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0x",
            STAKING_AUTOMATION_EOA: "0x",
            SPICE_AUCTION_OPERATOR: "0x",
            TEMPLE_GOLD: "0x8afB7E03a6e115577361C5648924eBA3163381Fc",
            TEMPLE_GOLD_ADMIN: "0x",
            TEMPLE_GOLD_STAKING: "0xa2f7B537B530481b12A5538bE7309fB6a34849f3",
            TEMPLE_TELEPORTER: "0x57cde11128c70948B910Bf34cF6F834c78B66b0f",
            SPICE_AUCTION: "0x51ebd148AE75B3e2CfDF972c94D7775B16060672",
            SPICE_AUCTION_FACTORY: "0x30223FD9CDBCb97F15FE188769B0170F2a993A3E",
            STABLE_GOLD_AUCTION: "0xF5B76f09B9df3eBD45155007590a9C14fEa2D4c1",
            TEAM_GNOSIS: "0x",
            SPICE_AUCTION_IMPLEMENTATION: "0x",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x",
        },
        CORE: {
            TEMPLE_TOKEN: "0x36061ce3Ac2F5d69667F0c7B98Ec6021ef33b8cB",
            EXECUTOR_MSIG: "0x",
            RESCUER_MSIG: "0x",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6EDCE65403992e310A62460808c4b910D972f10f",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x5879B1ae381DDbBa701170160162025d297ce3D3",
            },
            SKY: {
                USDS: "0x",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x",
            DAI_TGLD: "0x",
        },
    },
    localhost: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            STAKING_AUTOMATION_EOA: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            SPICE_AUCTION_OPERATOR: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            TEMPLE_GOLD: "0xAf7868a9BB72E16B930D50636519038d7F057470",
            TEMPLE_GOLD_ADMIN: "0xAbB1910DCFD0d7a0527Ad276b464324Dd4d2586B",
            TEMPLE_GOLD_STAKING: "0x4B7099FD879435a087C364aD2f9E7B3f94d20bBe",
            TEMPLE_TELEPORTER: "0x7914a8b73E11432953d9cCda060018EA1d9DCde9",
            SPICE_AUCTION: "0x",
            SPICE_AUCTION_FACTORY: "0xFBc00Fa47a7d3bbE3e82B5Aa560B47008c1bD64c",
            STABLE_GOLD_AUCTION: "0x99aA73dA6309b8eC484eF2C95e96C131C1BBF7a0",
            TEAM_GNOSIS: "0x",
            SPICE_AUCTION_IMPLEMENTATION: "0x98721EFD3D09A7Ae662C4D63156286DF673FC50B",
            STRATEGY_GNOSIS: "0x",
            SPICE_TOKEN: "0x",
        },
        CORE: {
            TEMPLE_TOKEN: "0x10d16E2A026C4b5264A2aAC51cA65749cDf2037E",
            EXECUTOR_MSIG: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            RESCUER_MSIG: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: '0x1a44076050125825900e736c501f859c50fE728c',
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            },
            SKY: {
                USDS: "0x",
            }
        },
        SPICE_AUCTIONS: {
            SPICE_TGLD: "0x",
            DAI_TGLD: "0x",
        },
    }
}

export function getDeployedTempleGoldContracts(): ContractAddresses {
    if (TEMPLEGOLD_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return TEMPLEGOLD_DEPLOYED_CONTRACTS[network.name];
    }
}

export interface ContractInstances {
    TEMPLE_GOLD: {
        TEMPLE_GOLD: TempleGold,
        TEMPLE_GOLD_ADMIN: TempleGoldAdmin,
        TEMPLE_GOLD_STAKING: TempleGoldStaking,
        TEMPLE_TELEPORTER: TempleTeleporter,
        SPICE_AUCTION: SpiceAuction,
        SPICE_AUCTION_FACTORY: SpiceAuctionFactory,
        STABLE_GOLD_AUCTION: StableGoldAuction,
        SPICE_TOKEN: FakeERC20,
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

export function connectToContracts(owner: Signer): ContractInstances {
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();

    return {
        TEMPLE_GOLD: {
            TEMPLE_GOLD: TempleGold__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner),
            TEMPLE_GOLD_ADMIN: TempleGoldAdmin__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN, owner),
            TEMPLE_GOLD_STAKING: TempleGoldStaking__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner),
            SPICE_AUCTION: SpiceAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION, owner),
            SPICE_AUCTION_FACTORY: SpiceAuctionFactory__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY, owner),
            STABLE_GOLD_AUCTION: StableGoldAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION, owner),
            TEMPLE_TELEPORTER: TempleTeleporter__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_TELEPORTER, owner),
            SPICE_TOKEN: FakeERC20__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_TOKEN, owner),
        },
        CORE: {
            TEMPLE_TOKEN: TempleERC20Token__factory.connect(TEMPLE_GOLD_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(TEMPLE_GOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
        }
    }
}