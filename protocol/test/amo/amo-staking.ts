import { ethers, network } from "hardhat";
import { expect, should } from "chai";
import { toAtto, shouldThrow, mineForwardSeconds } from "../helpers";
import { BigNumber, Signer } from "ethers";
import addresses from "../constants";
import { 
  TPFAMO,
  TPFAMO__factory,
  IERC20__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  IERC20,
  IBalancerVault,
  IBalancerVault__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  AuraStaking__factory,
  AuraStaking,
  ITempleERC20Token,
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  PoolHelper,
  PoolHelper__factory
} from "../../typechain";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';

const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER } = DEPLOYED_CONTRACTS.mainnet;
const { BALANCER_VAULT } = addresses.contracts;
const { FRAX_WHALE, BINANCE_ACCOUNT_8 } = addresses.accounts;
const { FRAX } = addresses.tokens;
const { DAI } = addresses.tokens;
const AURA_DEPOSIT_TOKEN = "0x1aF1cdC500A56230DF8A7Cf8099511A16D6e349e"; 
const TEMPLE_DAI_LP_TOKEN = "0x1b65fe4881800b91d4277ba738b567cbb200a60d";
const TEMPLE_BBAUSD_LP_TOKEN = "0x173063a30e095313eee39411f07e95a8a806014e";
const PID = 38;
const REWARDS = "0xB665b3020bBE8a9020951e9a74194c1BFda5C5c4";
const AURA_BOOSTER = "0x7818A1DA7BD1E64c199029E86Ba244a9798eEE10";
//const BALANCER_POOL_ID = "0x1b65fe4881800b91d4277ba738b567cbb200a60d0002000000000000000002cc";
const BALANCER_POOL_ID = "0x173063a30e095313eee39411f07e95a8a806014e0002000000000000000003ab";
const BALANCER_HELPERS = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";
const ONE_ETH = ethers.utils.parseEther("1");
const TEMPLE_WHALE = "0xf6C75d85Ef66d57339f859247C38f8F47133BD39";
const BLOCKNUMBER = 15834933;


let amo: TPFAMO;
let amoStaking: AuraStaking;
let owner: Signer;
let alan: Signer;
let operator: Signer;
let templeMultisig: Signer;
let fraxWhale: Signer;
let templeWhale: Signer;
let daiWhale: Signer;
let ownerAddress: string;
let alanAddress: string;
let operatorAddress: string;
let templeToken: TempleERC20Token;
let fraxToken: IERC20;
let daiToken: IERC20;
let bptToken: IERC20;
let depositToken: IERC20;
let balancerVault: IBalancerVault;
let balancerHelpers: IBalancerHelpers;
let weightedPool2Tokens: IWeightPool2Tokens;
let poolHelper: PoolHelper;

describe.only("Temple Price Floor AMO Staking", async () => {
    beforeEach( async () => {
        await resetFork(BLOCKNUMBER);
        [owner, alan, operator] = await ethers.getSigners();
        templeMultisig = await impersonateAddress(MULTISIG);
        templeWhale = await impersonateAddress(TEMPLE_WHALE);
        fraxWhale = await impersonateAddress(FRAX_WHALE);
        daiWhale = await impersonateAddress(BINANCE_ACCOUNT_8)
    
        ownerAddress = await owner.getAddress();
        alanAddress = await alan.getAddress();
        operatorAddress = await operator.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        fraxToken = IERC20__factory.connect(FRAX, fraxWhale);
        daiToken = IERC20__factory.connect(DAI, daiWhale);
        bptToken = IERC20__factory.connect(TEMPLE_DAI_LP_TOKEN, owner);
        depositToken = IERC20__factory.connect(AURA_DEPOSIT_TOKEN, owner);

        balancerVault = IBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_DAI_LP_TOKEN, owner);

        poolHelper = await new PoolHelper__factory(owner).deploy(
          BALANCER_VAULT,
          TEMPLE,
          BALANCER_POOL_ID
      )

        amoStaking = await new AuraStaking__factory(owner).deploy(
            ownerAddress,
            TEMPLE_DAI_LP_TOKEN,
            AURA_BOOSTER,
            AURA_DEPOSIT_TOKEN
        );
    
        amo = await new TPFAMO__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            DAI,
            TEMPLE_DAI_LP_TOKEN,
            amoStaking.address,
            AURA_BOOSTER,
            poolHelper.address
        );
        await amoStaking.setOperator(amo.address);
    });  
});

async function impersonateAddress(address: string) {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    });
    return ethers.provider.getSigner(address);
}

async function resetFork(blockNumber: Number) {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.TESTS_MAINNET_RPC_URL,
            blockNumber
          },
        },
      ],
    });
}