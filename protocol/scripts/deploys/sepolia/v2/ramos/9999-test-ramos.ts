import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  ensureExpectedEnvvars,
  mine,
} from "../../../helpers";
import { ContractInstances, connectToContracts } from "../contract-addresses";
import { BigNumber } from "ethers";

async function addLiquidity(TEMPLE_V2_INSTANCES: ContractInstances, amount: BigNumber) {
    const quote = await TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE.callStatic.proportionalAddLiquidityQuote(amount, "100");
    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE.addLiquidity(quote.requestData, {gasLimit:5000000}));
}

async function removeLiquidity(TEMPLE_V2_INSTANCES: ContractInstances, amount: BigNumber) {
    const quote = await TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE.callStatic.proportionalRemoveLiquidityQuote(amount, "100");
    await mine(TEMPLE_V2_INSTANCES.STRATEGIES.RAMOS_STRATEGY.INSTANCE.removeLiquidity(quote.requestData, amount, {gasLimit:5000000}));
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_INSTANCES = connectToContracts(owner);

    await addLiquidity(TEMPLE_V2_INSTANCES, ethers.utils.parseEther("1000000"));
    await removeLiquidity(TEMPLE_V2_INSTANCES, ethers.utils.parseEther("200000"));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });