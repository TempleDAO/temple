import { ethers, network } from "hardhat";
import { Signer } from "ethers";
import { fromAtto, toAtto } from "./helpers";
import { DEPLOYED_CONTRACTS } from '../scripts/deploys/helpers';
import addresses from "./constants";
import { 
  ERC20,
  ERC20__factory,
  TempleStableAMMRouter,
  TempleStableAMMRouter__factory,
  TreasuryIV,
  TreasuryIV__factory,
} from "../typechain";

const { FRAX } = addresses.tokens;
const { TEMPLE_STABLE_ROUTER } = addresses.contracts;
const { MULTISIG, TEMPLE_V2_FRAX_PAIR } = DEPLOYED_CONTRACTS.mainnet;

const BLOCK_NUMBER = 15778516;

let templeRouter: TempleStableAMMRouter;
let treasuryIV: TreasuryIV;
let templeMultisig: Signer;
let fraxToken: ERC20;

let owner: Signer;
let alan: Signer;

async function resetFork(blockNumber: number) {
  console.log(`Resetting fork to block: ${blockNumber}`);
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

async function impersonateAddress(address: string) {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return ethers.provider.getSigner(address);
}

describe("Temple Defend Updated", async () => {
  before(async () => {
    await resetFork(BLOCK_NUMBER);
    [owner, alan] = await ethers.getSigners();
    templeMultisig = await impersonateAddress(MULTISIG);
  });

  // reset to normal test state after all tests have finished
  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: []
    });
  });

  beforeEach(async () => {
    templeRouter = TempleStableAMMRouter__factory.connect(TEMPLE_STABLE_ROUTER, owner);
    treasuryIV = await new TreasuryIV__factory(owner).deploy(9700, 10000);
    fraxToken = ERC20__factory.connect(FRAX, owner);
  });

  async function runQuotes(templeAmounts: number[]) {
    console.log("$TEMPLE,$FRAX,RATE,PriceBelowIV");
    for (let i=0; i<templeAmounts.length; ++i) {
      const templeAmount = toAtto(templeAmounts[i]);
      const quote = await templeRouter.swapExactTempleForStableQuote(TEMPLE_V2_FRAX_PAIR, templeAmount);
      const effectiveRate = fromAtto(quote.amountOut) / templeAmounts[i];
      console.log(`${templeAmounts[i]},${fromAtto(quote.amountOut)},${effectiveRate},${quote.priceBelowIV}`);
    }
  }

  const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 9000;

  it("higher defend", async () => {
    const templeAmounts = [
      1,
      100,
      1000,
      10000,
      100000,
      1000000,
    ];

    // Temple trading below at .948, uses univ2
    await runQuotes(templeAmounts);

    // Buy TEMPLE with FRAX
    {
      const amount = toAtto(125000);
      const fraxWhale = await impersonateAddress("0x031FeF8Fa26BC5814FfA312B955Af1a5cBd4655A");
      await fraxToken.connect(fraxWhale).approve(templeRouter.address, amount);
      await templeRouter.connect(fraxWhale).swapExactStableForTemple(amount, 1, fraxToken.address, await alan.getAddress(), expiryDate());
    }
    await runQuotes(templeAmounts);

    // Update the AMM to use a fixed 0.97 IV
    await templeRouter.connect(templeMultisig).setTreasury(treasuryIV.address);
    await runQuotes(templeAmounts);
  });
});
