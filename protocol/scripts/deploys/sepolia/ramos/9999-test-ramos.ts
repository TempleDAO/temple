import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  ensureExpectedEnvvars,
  mine,
} from "../../helpers";
import { connectToContracts } from "../contract-addresses";

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);

    const amount = ethers.utils.parseEther("1000000");
    const quote = await TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE.callStatic.proportionalAddLiquidityQuote(amount, "100");

    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE.addLiquidity(quote.requestData, {gasLimit:5000000}));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });