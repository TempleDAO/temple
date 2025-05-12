import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGold__factory, TempleGoldAdmin__factory, 
    TempleGoldStaking__factory, TempleTeleporter__factory,
    StableGoldAuction__factory, FakeERC20__factory, 
    SpiceAuctionFactory__factory,
    SpiceAuction__factory} from '../../../../typechain';
import {
  mine,
  deployAndMine,
  ensureExpectedEnvvars,
  toAtto,
} from '../../helpers';
import { getDeployedTempleGoldContracts, connectToContracts } from '../../mainnet/templegold/contract-addresses';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

async function main() {
  ensureExpectedEnvvars();
  const [owner, rescuer] = await ethers.getSigners();
  
//   await _deployTempleToken(owner);
//   await _deployTempleGold(owner);
//   await _deployTempleGoldAdmin(owner, rescuer);

//   await _deployTempleGoldStaking(owner, rescuer);
//   await _deployTempleTeleporter(owner);

//   await _deployStableGoldAuction(owner, rescuer);

//   await _deploySpiceImplementation(owner);
//   await _deploySpiceFactory(owner, rescuer);
//   await _deployDaiTgldSpice(owner);
// @todo apply overrides
}

async function _deployDaiTgldSpice(owner: SignerWithAddress) {
    const INSTANCES = connectToContracts(owner);
    const CONTRACTS = getDeployedTempleGoldContracts();
    const name = 'DAI_TGLD_SPICE_AUCTION';
    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.createAuction(CONTRACTS.EXTERNAL.MAKER_DAO.DAI_TOKEN, name));
    console.log(`${name} = ${await INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.deployedAuctions(CONTRACTS.EXTERNAL.MAKER_DAO.DAI_TOKEN, 1)}`);
}

async function _deploySpiceImplementation(owner: SignerWithAddress) {
    const factory = new SpiceAuction__factory(owner);
    await deployAndMine(
        'SPICE_AUCTION_IMPLEMENTATION',
        factory,
        factory.deploy
    );
}

async function _deploySpiceFactory(owner: SignerWithAddress, rescuer: SignerWithAddress) {
    const factory = new SpiceAuctionFactory__factory(owner);
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
    await deployAndMine(
        'SPICE_AUCTION_FACTORY',
        factory,
        factory.deploy,
        TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
        await rescuer.getAddress(),
        await owner.getAddress(), // executor
        await owner.getAddress(), // dao executor
        await owner.getAddress(), // operator
        await owner.getAddress(), // strategy gnosis
        TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
        30101,
        1
    );
}

async function _deployTempleToken(owner: SignerWithAddress) {
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'TEMPLE_TOKEN',
        factory,
        factory.deploy,
        "Temple",
        "TEMPLE",
        await owner.getAddress(),
        toAtto(1000)
    );
}

async function _deployTempleGold(owner: SignerWithAddress) {
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
    // const ARBITRUM_ONE_CHAIN_ID = 42161;
    // const ARBITRUM_ONE_LZ_EID = 30110;
    const MINT_CHAIN_ID = 1;
    const MINT_CHIN_EID = 30101;
    const _initArgs =  {
        // Changed in transfer ownership to TempleAdmin
        executor: await owner.getAddress(), // executor is also used as delegate in LayerZero Endpoint.
        layerZeroEndpoint: TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
        mintChainId: MINT_CHAIN_ID,
        mintChainLzEid: MINT_CHIN_EID,
        name: "TEMPLE GOLD",
        symbol: "TGLD"
    };
    const factory = new TempleGold__factory(owner);
    await deployAndMine(
        'TEMPLE_GOLD',
        factory,
        factory.deploy,
        _initArgs
    );
}

async function _deployTempleGoldAdmin(owner: SignerWithAddress, rescuer: SignerWithAddress) {
    const factory = new TempleGoldAdmin__factory(owner);
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
    await deployAndMine(
        'TEMPLE_GOLD_ADMIN',
        factory,
        factory.deploy,
        await rescuer.getAddress(),
        await owner.getAddress(),
        TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD
    );
}

async function _deployTempleGoldStaking(owner: SignerWithAddress, rescuer: SignerWithAddress) {
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  
    const factory = new TempleGoldStaking__factory(owner);
    await deployAndMine(
      'TEMPLE_GOLD_STAKING',
      factory,
      factory.deploy,
      await rescuer.getAddress(),
      await owner.getAddress(),
      TEMPLEGOLD_ADDRESSES.CORE.TEMPLE_TOKEN,  //   CORE_ADDRESSES.CORE.TEMPLE_TOKEN,
      TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD
    );
}

async function _deployTempleTeleporter(owner: SignerWithAddress) {
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();

    const factory = new TempleTeleporter__factory(owner);
    await deployAndMine(
        'TEMPLE_TELEPORTER',
        factory,
        factory.deploy,
        await owner.getAddress(),
        TEMPLEGOLD_ADDRESSES.CORE.TEMPLE_TOKEN,
        TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT
    );
}

async function _deployStableGoldAuction(owner: SignerWithAddress, rescuer: SignerWithAddress): Promise<void> {
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
    // const arbDaiToken = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
    const factory = new StableGoldAuction__factory(owner);
    await deployAndMine(
        'STABLE_GOLD_AUCTION',
        factory,
        factory.deploy,
        TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
        TEMPLEGOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
        await owner.getAddress(), // treasury
        await rescuer.getAddress(),
        await owner.getAddress(),
        TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.AUCTION_AUTOMATION_EOA
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });