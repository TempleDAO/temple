import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { expect } from "chai";

import { TempleERC20Token } from "../../typechain/TempleERC20Token";
import { TempleStaking } from "../../typechain/TempleStaking";
import { OGTemple } from "../../typechain/OGTemple";
import { blockTimestamp, fromAtto, mineToEpoch, shouldThrow, toAtto } from "./helpers";
import { TempleERC20Token__factory } from "../../typechain/factories/TempleERC20Token__factory";
import { ExitQueue } from "../../typechain/ExitQueue";
import { ExitQueue__factory } from "../../typechain/factories/ExitQueue__factory";
import { TempleStaking__factory } from "../../typechain/factories/TempleStaking__factory";
import { OGTemple__factory } from "../../typechain/factories/OGTemple__factory";
import { MintAllowance } from "../../typechain";
import { time } from "console";
import { entropyToMnemonic } from "ethers/lib/utils";

// Calculate a balance from a time series of stake amount/epy changes
const calcBalanceFromTimeseries = (events: {staked: number, epy: number}[]) => {
  let balance = 0;
  let prevEpochEpy = 0;
  for (let i = 0; i < events.length; i++) {
    balance = balance * (1 + prevEpochEpy);
    balance += events[i].staked;
    prevEpochEpy = events[i].epy;
  }
  return balance * (1 + prevEpochEpy);
}

// List of test cases, used to verify both our own independent implementation
// and interest calcs on chain
const stakingCases: [string, [number, number][], number][] = [
  ["100 at 0.1 over a single epochs", 
    [[100, 0.1]], 110
  ],
  ["100 at 0.1 over 3 epochs", 
    [ [100, 0.1], [0,0.1], [0,0.1] ], 
    100 * (1.1**3)
  ],
  ["100 at 0.1 over 3 epochs, then an extra 100 at 0.1 over the last 2",
    [ [100, 0.1], [0,0.1], [0,0.1], [100, 0.1], [0, 0.1] ],
    100 * (1.1**5) + 100 * (1.1**2)
  ],
  ["EPY Drops per epoch, balance fixed",
    [ [100, 0.1], [0, 0.08], [0, 0.06], [0, 0.04], [0, 0.02] ],
    100 * 1.1 * 1.08 * 1.06 * 1.04 * 1.02
  ],
  ["EPY flat + withdrawal",
    [[100, 0.1], [0, 0.1], [-100, 0.1], [0, 0.1], [0, 0.1] ],
    (100 * 1.1**2 - 100) * 1.1**3
  ],
  ["EPY varies + withdrawal",
    [[100, 0.1], [0, 0.08], [-100, 0.06], [0, 0.04], [0, 0.02] ],
    ((100 * 1.1 * 1.08) - 100) * 1.06 * 1.04 * 1.02,
  ],
  ["Both balance and EPY varies",
    [[100, 0.1], [50, 0.08], [-100, 0.06], [20, 0.04], [0, 0.02]],
    (((100 * 1.1 + 50) * 1.08 - 100) * 1.06 + 20) * 1.04 * 1.02
  ],
  ["No EPY, single epoch",
    [[100, 0]], 100
  ],
  ["No EPY, multiple epochs",
    [[100, 0], [0, 0], [100, 0], [0, 0], [300, 0]],
    500,
  ],
  ["No EPY as an interim state",
    [[100, 0.1], [0, 0], [0, 0.1]],
    100 * 1.1**2,
  ],
  ["Fixed EPY, Large stakes", 
    [[100000000, 0.1], [0, 0.1], [1000000000, 0.1], [0, 0.1], [100000000000, 0.1]],
    100000000 * 1.1**5 + 1000000000 * 1.1**3 + 100000000000 * 1.1
  ]
];

describe("Verify test implementation of timeseries balance calc", async () => {
  stakingCases.forEach(c => {
    const [description, timeseries, expected] = c;

    it(description, () => {
      expect(calcBalanceFromTimeseries(timeseries.map(([staked, epy]: [number, number]) => {return {staked,epy}}))).approximately(expected, 1e-6);
    })
  })
});

describe("Temple ERC20 Staking Configuration Controls", async () => {
   let TEMPLE: TempleERC20Token;
   let EXIT_QUEUE: ExitQueue
   let STAKING: TempleStaking;
   let owner: Signer;
   let nonOwner: Signer;

   beforeEach(async () => {
     [owner, nonOwner] = (await ethers.getSigners()) as Signer[];

     TEMPLE = await new TempleERC20Token__factory(owner).deploy()
     EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      200, /* max per epoch */
      100, /* max per address per epoch */
      5, /* epoch size, in blocks */
    )
     
    STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      5, /* epoch size, in seconds */
      (await blockTimestamp()) - 1,
    );
     
     await STAKING.setEpy(10,100);
   })

   it("Only owner can set EPY", async () => {
     // epy round trip isn't exact (given floating point math), but
     // close enough for reporting
 
     await STAKING.setEpy(20,100);
     expect((await STAKING.getEpy(1000)).toNumber()).approximately(200, 1)
 
     await shouldThrow(STAKING.connect(nonOwner).setEpy(10,100), /Ownable: caller is not the owner/);
     expect((await STAKING.getEpy(1000)).toNumber()).approximately(200, 1); 
   });

   it("Start time must be no more than 2 days less than now", async () => {
     const deployStaking = async (startTime: number) => {
      await new TempleStaking__factory(owner).deploy(TEMPLE.address, EXIT_QUEUE.address, 5, startTime);
     }


     const now = (await blockTimestamp());
     await shouldThrow(deployStaking(now + 100), /Start timestamp must be in the past/);
     await shouldThrow(deployStaking(now - (24 * 2 * 60 * 60) - 100), /Start timestamp can't be more than 2 days in the past/);
   });
});

describe("Temple ERC20 Staking Mechanics", async () => {
  let TEMPLE: TempleERC20Token;
  let EXIT_QUEUE: ExitQueue;
  let STAKING: TempleStaking;
  let OG_TEMPLE: OGTemple
  const epochSizeSeconds = 20;

  let owner: Signer;
  let amanda: Signer;
  let ben: Signer;
  let clint: Signer;

  beforeEach(async () => {
    [owner,amanda,ben,clint] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      toAtto(2000), /* max per epoch */
      toAtto(1000), /* max per address per epoch */
      epochSizeSeconds, /* epoch size, in blocks */
    )
     
    STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      epochSizeSeconds, /* epoch size, in seconds */
      (await blockTimestamp()) - 1,
    );

    OG_TEMPLE = new OGTemple__factory(owner).attach(await STAKING.OG_TEMPLE());

    await STAKING.setEpy(10,100);

    // mint a bunch of temple to all users + staking contract
    await TEMPLE.addMinter(await owner.getAddress());

    await TEMPLE.mint(await owner.getAddress(),  toAtto(100000));
    await TEMPLE.mint(await amanda.getAddress(), toAtto(100000));
    await TEMPLE.mint(await ben.getAddress(),    toAtto(100000));
    await TEMPLE.mint(await clint.getAddress(),  toAtto(1000000000));
    await TEMPLE.mint(STAKING.address,           toAtto(1000000000));
  })

  it("Can't stake 0 tokens", async () => {
    await shouldThrow(STAKING.connect(amanda).stake(0), /Cannot stake 0 tokens/);
  });

  it("Staker allowance must be equal or greater than amount staked", async () => {
    await shouldThrow(STAKING.connect(amanda).stake(100), /transfer amount exceeds allowance/);
    await TEMPLE.connect(amanda).increaseAllowance(STAKING.address, 50);
    await shouldThrow(STAKING.connect(amanda).stake(100), /transfer amount exceeds allowance/);

    // no change in allowance, as stake should have failed
    expect(await TEMPLE.allowance(await amanda.getAddress(), STAKING.address)).eq(50);
  });

  it("User can stake and accumulate rewards", async () => {
    const amandaAddress = await amanda.getAddress();
    let totalStaked = 0;
    const statePerEpoch: {staked: number, epy: number}[] = [{staked: 0, epy: (await STAKING.getEpy(1000000)).toNumber() / 1000000}];

    let currentEpoch = (await STAKING.currentEpoch()).toNumber();;
    const mineToNextEpoch = async () => {
       const epy = (await STAKING.getEpy(1000000)).toNumber() / 1000000;
       statePerEpoch[statePerEpoch.length-1].epy = epy;
       statePerEpoch.push({staked: 0, epy});
       await mineToEpoch((await STAKING.startTimestamp()).toNumber(), (await STAKING.epochSizeSeconds()).toNumber(), ++currentEpoch);
    }

    // helper to stake, which also updates state change timeseries
    const stake = async (amount: number) => {
      await TEMPLE.connect(amanda).increaseAllowance(STAKING.address, toAtto(amount));
      await STAKING.connect(amanda).stake(toAtto(amount));
      statePerEpoch[statePerEpoch.length-1].staked += amount;
      totalStaked += amount;
    }

    // calc in a loop over all state changes, should reconcile with maths on chain
    // leave out last epoch - as these tests add an extra state entry when mining an epoch, however, this
    // reflects the state once that epoch passes (as opposed to at the start of the epoch)
    const calcBalance = () => {
      const stateCopy = statePerEpoch.slice();
      stateCopy[stateCopy.length-1].epy = 0;
      return calcBalanceFromTimeseries(stateCopy);
    }

    // Should have OGTemple after initial stake, and no rewards. OG Temple should equal amount staked, as
    // we are staking at epoch 0
    await stake(10000);
    expect(await STAKING.currentEpoch()).eq(0);
    let ogTempleBalance = await OG_TEMPLE.balanceOf(amandaAddress);
    expect(fromAtto(ogTempleBalance)).approximately(totalStaked, 1);
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(totalStaked,1);

    // should have one epoch worth of rewards after 1 epoch
    await mineToNextEpoch();
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);

    // should accumulate two epoch worth after another epoch
    await mineToNextEpoch();
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);

    // Ensure rewards are accurate if we change epy, epy changes only kick in on next epoch
    STAKING.setEpy(5,100);
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);
    await mineToNextEpoch();
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);

    // Increasing a users stake should calc rewards as expected. Specifically, Emmediately
    // after stake, there should be no extra rewards for the 10k extra staked
    await stake(10000);
    ogTempleBalance = await OG_TEMPLE.balanceOf(amandaAddress);
    expect(fromAtto(ogTempleBalance)).approximately(17871, 1);
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);

    // Next epoch, we expect rewards to be calculated going forward on a higher base (includes extra staked amount)
    await mineToNextEpoch();
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);

    // Unstake should effect both balance and rewards going forward
    OG_TEMPLE.connect(amanda).increaseAllowance(STAKING.address, toAtto(10000));
    statePerEpoch[statePerEpoch.length-1].staked = -fromAtto(await STAKING.balance(toAtto(10000)));
    await STAKING.connect(amanda).unstake(toAtto(10000));
    ogTempleBalance = await OG_TEMPLE.balanceOf(amandaAddress);
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);
    await mineToNextEpoch();
    expect(fromAtto(await STAKING.balance(ogTempleBalance))).approximately(calcBalance(),1);
  });

  it("User can unstake", async () => {
    // can only unstake if staked
    await shouldThrow(STAKING.unstake(100), /Insufficient OGTemple allowance. Cannot unstake/);

    await TEMPLE.connect(amanda).increaseAllowance(STAKING.address, toAtto(10000));
    await STAKING.connect(amanda).stake(toAtto(10000));
    const nOgTemple = await OG_TEMPLE.balanceOf(await amanda.getAddress());
    expect(fromAtto(nOgTemple)).approximately(10000,1);
    await OG_TEMPLE.connect(amanda).increaseAllowance(STAKING.address, nOgTemple);
    await STAKING.connect(amanda).unstake(nOgTemple);
    expect(await OG_TEMPLE.balanceOf(await amanda.getAddress())).eq(0);
  });

  it("User (more likely contract) can stake on behalf of another user", async () => {
    const amandaAddress = await amanda.getAddress();

    // Can stake for another user, as long as the caller has the appropriate allowance
    await TEMPLE.connect(owner).increaseAllowance(STAKING.address, toAtto(10000));
    const nOgTemple = await STAKING.connect(owner).stakeFor(amandaAddress, toAtto(10000));
    await shouldThrow(STAKING.connect(owner).stakeFor(amandaAddress, toAtto(10000)), /transfer amount exceeds allowance/);
  });
});

describe("Table driven tests to check stake/unstake calcs", async () => {
  let TEMPLE: TempleERC20Token;
  let EXIT_QUEUE: ExitQueue;
  let STAKING: TempleStaking;
  let OG_TEMPLE: OGTemple
  const epochSizeSeconds = 10;

  let owner: Signer;
  let amanda: Signer;

  beforeEach(async () => {
    [owner,amanda] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      toAtto(200), /* max per epoch */
      toAtto(100), /* max per address per epoch */
      epochSizeSeconds, /* epoch size, in blocks */
    )
     
    STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      epochSizeSeconds, /* epoch size, in seconds */
      (await blockTimestamp()) - 1,
    );

    OG_TEMPLE = new OGTemple__factory(owner).attach(await STAKING.OG_TEMPLE());

    // mint a bunch of temple to all users + staking contract
    await TEMPLE.addMinter(await owner.getAddress());
    await TEMPLE.mint(await owner.getAddress(),  toAtto(200000000000));
    await TEMPLE.mint(await amanda.getAddress(), toAtto(200000000000));
    await TEMPLE.mint(STAKING.address,           toAtto(200000000000));
  })

  stakingCases.forEach(c => {
    const [description, timeseries, expected] = c;

    it(description, async () => {
      await TEMPLE.connect(amanda).increaseAllowance(STAKING.address, toAtto(200000000000));
      const startTimestamp = (await STAKING.startTimestamp()).toNumber();
      let currentEpoch = (await STAKING.currentEpoch()).toNumber();

      const stateToDate = [];
      for (let i = 0; i < timeseries.length; i++) {
        const entry = {staked: timeseries[i][0], epy: timeseries[i][1]};

        if (entry.staked > 0) {
          await STAKING.connect(amanda).stake(toAtto(entry.staked))
        } else if (entry.staked < 0) {
          const ogTempleUnstake = -entry.staked *  10000 / (await STAKING.getAccumulationFactor(10000)).toNumber();
          await OG_TEMPLE.connect(amanda).increaseAllowance(STAKING.address, toAtto(ogTempleUnstake));
          await STAKING.connect(amanda).unstake(toAtto(ogTempleUnstake));
        }
        expect(fromAtto(await STAKING.balance(await OG_TEMPLE.balanceOf(await amanda.getAddress())))).approximately(calcBalanceFromTimeseries(stateToDate) + entry.staked, 1);
        await STAKING.setEpy(entry.epy * 10000, 10000);

        stateToDate.push(entry);
        await mineToEpoch(startTimestamp, epochSizeSeconds, ++currentEpoch);
      }
      expect(fromAtto(await STAKING.balance(await OG_TEMPLE.balanceOf(await amanda.getAddress())))).approximately(calcBalanceFromTimeseries(stateToDate), 1);
      expect(fromAtto(await STAKING.balance(await OG_TEMPLE.balanceOf(await amanda.getAddress())))).approximately(expected, 1);
    })
  })
});