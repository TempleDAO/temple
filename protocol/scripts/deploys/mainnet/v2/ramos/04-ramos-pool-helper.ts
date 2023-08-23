import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from "../../../helpers";
import { BalancerPoolHelper__factory } from "../../../../../typechain";
import { getDeployedContracts } from '../contract-addresses';
import { IBalancerVault__factory } from "../../../../../typechain/factories/contracts/zaps/interfaces";

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const poolHelperFactory = new BalancerPoolHelper__factory(owner);

  const vault = IBalancerVault__factory.connect(TEMPLE_V2_ADDRESSES.EXTERNAL.BALANCER.VAULT, owner);
  const balPoolTokens = await vault.getPoolTokens(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_POOL_ID); 
  const protocolTokenBalancerPoolIndex = balPoolTokens.tokens[0].toUpperCase() == TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN.toUpperCase() ? 0 : 1;

  await deployAndMine(
    "RAMOS.TEMPLE_DAI.POOL_HELPER",
    poolHelperFactory,
    poolHelperFactory.deploy,
    TEMPLE_V2_ADDRESSES.EXTERNAL.BALANCER.VAULT,
    TEMPLE_V2_ADDRESSES.EXTERNAL.BALANCER.HELPERS,
    TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
    TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_LP_TOKEN,
    TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.ADDRESS,
    protocolTokenBalancerPoolIndex,
    TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_POOL_ID
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
