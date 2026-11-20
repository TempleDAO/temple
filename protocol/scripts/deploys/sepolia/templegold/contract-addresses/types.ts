import { SpiceAuction, FakeERC20 } from "../../../../../typechain";
import { BaseContractAddresses, BaseContractInstances } from "../../../templegold/types";

export interface ContractAddresses extends BaseContractAddresses {
     GRANARY: {
        FIXED_PRICE_AUCTION_IMPLEMENTATION: string,
        FIXED_PRICE_AUCTION_FACTORY: string,
        COMPLIANCE_CHECK: string,
        WISHING_WELL: string,
        FIXED_PRICE_AUCTION: string,
    },
    TEMPLE_GOLD: BaseContractAddresses['TEMPLE_GOLD'] & {
        SPICE_AUCTION: string,
        SPICE_TOKEN: string,
    },
}

export interface ContractInstances extends BaseContractInstances {
    TEMPLE_GOLD: BaseContractInstances['TEMPLE_GOLD'] & {
        SPICE_AUCTION: SpiceAuction,
        SPICE_TOKEN: FakeERC20,
    },
}
