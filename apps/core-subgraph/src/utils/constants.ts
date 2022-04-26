import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';


export const BIG_INT_1E18 = BigInt.fromString('1000000000000000000');
export const BIG_INT_1E7 = BigInt.fromString('10000000');
export const BIG_INT_0 = BigInt.fromI32(0);
export const BIG_INT_1 = BigInt.fromI32(1);

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18');
export const BIG_DECIMAL_1E7 = BigDecimal.fromString('1e7');
export const BIG_DECIMAL_0 = BigDecimal.fromString('0');

export const GAUGE_CONTROLLER = '0x8EfeB2ef8f4dF4892D7115160eFDcD5F93Eb3F26';
export const GAUGE_CONTROLLER_ADDRESS = Address.fromString('0x8EfeB2ef8f4dF4892D7115160eFDcD5F93Eb3F26');
export const VOTING_ESCROW = Address.fromString('0x617d46FcECA1C8290d191709F93118e593a459d3');
export const DUAL_REWARDS_ADDRESS = Address.fromString('0x17979fe6643f056d99717EcB40cdc2FFb5830576');
export const SMART_WALLET_WL_ADDRESS = Address.fromString('0x409a9Ba77FfE1a7701E0A08F32c38a2b9707C7D7');

export const STAX_ERC20_CONTRACT = Address.fromString('0x1F747beA017eC1B023BebA463BA5d31E10d3286f');
export const FXS_ERC20_CONTRACT = Address.fromString('0x9cB761d3f220262F03120098F0a9170f83a00C0e');
export const FXS_STAX_LP = Address.fromString('0x757405819fA116982F03DAedD65c779728e349c8');
export const FXS_PRICE_FEED = Address.fromString('0x6c0fe985d3cacbcde428b84fc9431792694d0f51');
