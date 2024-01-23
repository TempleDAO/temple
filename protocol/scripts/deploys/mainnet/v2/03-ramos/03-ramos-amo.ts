import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
    IBalancerVault__factory,
    Ramos__factory
} from "../../../../../typechain";
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from "../../../helpers";
import { getDeployedContracts } from '../contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();

    const vault = IBalancerVault__factory.connect(TEMPLE_V2_ADDRESSES.EXTERNAL.BALANCER.VAULT, owner);
    const balPoolTokens = await vault.getPoolTokens(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_POOL_ID); 
    const protocolTokenBalancerPoolIndex = balPoolTokens.tokens[0].toUpperCase() == TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN.toUpperCase() ? 0 : 1;

    const amoFactory: Ramos__factory = new Ramos__factory(owner);
    await deployAndMine(
        "RAMOS.TEMPLE_DAI.ADDRESS",
        amoFactory,
        amoFactory.deploy,
        TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
        await owner.getAddress(),
        TEMPLE_V2_ADDRESSES.EXTERNAL.BALANCER.VAULT,
        TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
        TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_LP_TOKEN,
        TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.AURA_STAKING,
        protocolTokenBalancerPoolIndex,
        TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.EXTERNAL.BALANCER_POOL_ID,
        TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.FEE_COLLECTOR,
        0, // 0% max fees for protocol version of ramos
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
