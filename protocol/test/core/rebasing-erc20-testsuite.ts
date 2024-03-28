import { expect } from "chai";
import { fromAtto, toAtto } from "../helpers";
import { BigNumber, Signer } from "ethers";
import { 
  IERC20,
} from "../../typechain";

interface RebasingERC20TestSuiteState {
  accounts: [Signer, BigNumber][];
  token: IERC20;
  rebaseUp: () => Promise<any>;
  rebaseDown: () => Promise<any>;
}

export const mkRebasingERC20TestSuite = (setup: () => Promise<RebasingERC20TestSuiteState>) => {
  describe("ERC20 verification", async () => {
    let accounts: [Signer, BigNumber][] = [];
    let token: IERC20;
    let rebaseUp: () => Promise<number>;
    let rebaseDown: () => Promise<number>;

    const mkRebaser = (doRebase: () => Promise<void>) => {
      return async () => {
        const preRebaseTotalSupply = fromAtto(await token.totalSupply());
        await doRebase();
        return fromAtto(await token.totalSupply()) / preRebaseTotalSupply;
      }
    }

    beforeEach(async () => {
      const testState = await setup();

      accounts = testState.accounts;
      token = testState.token;
      rebaseUp = mkRebaser(testState.rebaseUp);
      rebaseDown = mkRebaser(testState.rebaseDown);
    })

    it("Has expected initial balances", async () => {
      for (const [user, initialBalance] of accounts) {
        expect(await token.balanceOf(await user.getAddress())).eql(initialBalance)
      }
    })

    it("Transfer changes balances", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await expect(async () => token.connect(alan).transfer(await ben.getAddress(), 111))
        .to.changeTokenBalances(token, [alan, ben], [-111, 111])
    })

    it("Transfer works when rebasing up", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await expect(async () => token.connect(alan).transfer(await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])

      await rebaseUp();
      await expect(async () => token.connect(alan).transfer(await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])
    })

    it("Transfer works when rebasing down", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await expect(async () => token.connect(alan).transfer(await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])

      await rebaseDown();
      await expect(async () => token.connect(alan).transfer(await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])
    })

    it("Transfer emits event", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await expect(token.connect(alan).transfer(await ben.getAddress(), toAtto(100)))
        .to.emit(token, "Transfer")
        .withArgs(await alan.getAddress(), await ben.getAddress(), toAtto(100))
    })

    it("Can not transfer above the amount", async () => {
      const [[alan, alanBalance], [ben, ]] = accounts;

      await expect(token.connect(alan).transfer(await ben.getAddress(), alanBalance.add(toAtto(100))))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    })

    it("totalSupply", async () => {
      let expectedTotalSupply = BigNumber.from(0);

      for (const [, initialBalance] of accounts) {
        expectedTotalSupply = expectedTotalSupply.add(initialBalance);
      }

      expect(await token.totalSupply()).eql(expectedTotalSupply);
    })

    it("rebase up changes balances + totalSupply correctly", async () => {
      const rebaseFactor = await rebaseUp();

      let expectedTotalSupply = BigNumber.from(0);
      for (const [user, initialBalance] of accounts) {
        expect(fromAtto(await token.balanceOf(await user.getAddress()))).eq(fromAtto(initialBalance) * rebaseFactor);
        expectedTotalSupply = expectedTotalSupply.add(initialBalance);
      }

      expect(fromAtto(await token.totalSupply())).eq(fromAtto(expectedTotalSupply) * rebaseFactor);
    })

    it("rebase down changes balances + totalSupply correctly", async () => {
      const rebaseFactor = await rebaseDown();

      let expectedTotalSupply = BigNumber.from(0);
      for (const [user, initialBalance] of accounts) {
        expect(fromAtto(await token.balanceOf(await user.getAddress()))).eq(fromAtto(initialBalance) * rebaseFactor)
        expectedTotalSupply = expectedTotalSupply.add(initialBalance);
      }

      expect(fromAtto(await token.totalSupply())).eq(fromAtto(expectedTotalSupply) * rebaseFactor);
    })

    it("allowance", async () => {
      const [[alan, ], [ben, ]] = accounts;

      expect(await token.allowance(await alan.getAddress(), await ben.getAddress())).eq(0);
      await token.connect(alan).approve(await ben.getAddress(), 111);
      expect(await token.allowance(await alan.getAddress(), await ben.getAddress())).eq(111);
    })

    it("allowance remains unchanged during rebases", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await token.connect(alan).approve(await ben.getAddress(), toAtto(111));
      expect(fromAtto(await token.allowance(await alan.getAddress(), await ben.getAddress()))).eq(111);

      await rebaseUp();
      expect(fromAtto(await token.allowance(await alan.getAddress(), await ben.getAddress()))).eq(111);

      await rebaseDown();
      expect(fromAtto(await token.allowance(await alan.getAddress(), await ben.getAddress()))).eq(111);
    })

    it("transferFrom", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await expect(token.transferFrom(await alan.getAddress(), await ben.getAddress(), 111))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

      await token.connect(alan).approve(await ben.getAddress(), 111);

      await expect(async () => token.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), 111))
        .to.changeTokenBalances(token, [alan, ben], [-111, 111]);
    })

    it("transferFrom works when rebasing up", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await token.connect(alan).approve(await ben.getAddress(), toAtto(1000));

      await expect(async () => token.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])

      await rebaseUp();
      await expect(async () => token.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])
    })

    it("transferFrom works when rebasing down", async () => {
      const [[alan, ], [ben, ]] = accounts;

      await token.connect(alan).approve(await ben.getAddress(), toAtto(1000));

      await expect(async () => token.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])

      await rebaseDown();
      await expect(async () => token.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(token, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])
    })
  });
}