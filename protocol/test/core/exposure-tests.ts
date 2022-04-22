import { ethers } from "hardhat";
import { expect } from "chai";
import { fromAtto, NULL_ADDR, toAtto } from "../helpers";
import { BigNumber, Signer } from "ethers";
import { 
  Exposure,
  Exposure__factory,
  IERC20,
} from "../../typechain";
import { mkRebasingERC20TestSuite } from "./rebasing-erc20-testsuite";

interface RebasingERC20TestSuiteState {
  accounts: [Signer, BigNumber][];
  token: IERC20;
  rebaseUp: () => Promise<any>;
  rebaseDown: () => Promise<any>;
}

describe("Temple Core Exposures", async () => {
  let exposure: Exposure;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer;

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    exposure = await new Exposure__factory(owner).deploy(
        "Test Exposure",
        "TE_FXS",
        NULL_ADDR,
        await owner.getAddress(),
    );

    await exposure.setMinterState(await owner.getAddress(), true);
  });

  mkRebasingERC20TestSuite(async () => {
    await exposure.mint(await alan.getAddress(), toAtto(300));
    await exposure.mint(await ben.getAddress(), toAtto(300));

    return {
      accounts: [[alan, toAtto(300)], [ben, toAtto(300)]],
      token: exposure as unknown as IERC20,
      rebaseUp: async () => await exposure.increaseReval(toAtto(600)),
      rebaseDown: async () => await exposure.increaseReval(toAtto(200)),
    }
  })
})

