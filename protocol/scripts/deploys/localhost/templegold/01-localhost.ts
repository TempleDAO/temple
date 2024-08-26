import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGold__factory, TempleGoldAdmin__factory, 
    TempleGoldStaking__factory, TempleTeleporter__factory,
    DaiGoldAuction__factory, FakeERC20__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  toAtto,
} from '../../helpers';
import { getDeployedContracts } from '../../mainnet/v2/contract-addresses';
import { getDeployedTempleGoldContracts } from '../../arbitrumOne/contract-addresses';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractAddresses } from '@balancer-labs/sdk';

async function main() {
  ensureExpectedEnvvars();
  const [owner, rescuer] = await ethers.getSigners();
  
  await _deployTempleToken(owner);
  await _deployTempleGold(owner);
  await _deployTempleGoldAdmin(owner, rescuer);

  await _deployTempleGoldStaking(owner, rescuer);
  await _deployTempleTeleporter(owner);

  await _deployDaiGoldAuction(owner, rescuer);
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
    const ARBITRUM_ONE_CHAIN_ID = 42161;
    const ARBITRUM_ONE_LZ_EID = 30110;
    const _initArgs =  {
        // Changed in transfer ownership to TempleAdmin
        executor: await owner.getAddress(), // executor is also used as delegate in LayerZero Endpoint.
        layerZeroEndpoint: TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
        mintChainId: ARBITRUM_ONE_CHAIN_ID,
        mintChainLzEid: ARBITRUM_ONE_LZ_EID,
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
    const CORE_ADDRESSES = getDeployedContracts(); 
  
  
    const factory = new TempleGoldStaking__factory(owner);
    await deployAndMine(
      'TEMPLE_GOLD_STAKING',
      factory,
      factory.deploy,
      await rescuer.getAddress(),
      await owner.getAddress(),
      CORE_ADDRESSES.CORE.TEMPLE_TOKEN,
      TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD
    );
}

async function _deployTempleTeleporter(owner: SignerWithAddress) {
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const CORE_ADDRESSES = getDeployedContracts(); 

    const factory = new TempleTeleporter__factory(owner);
    await deployAndMine(
        'TEMPLE_TELEPORTER',
        factory,
        factory.deploy,
        await owner.getAddress(),
        CORE_ADDRESSES.CORE.TEMPLE_TOKEN,
        TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT
    );
}

async function _deployDaiGoldAuction(owner: SignerWithAddress, rescuer: SignerWithAddress): Promise<void> {
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const arbDaiToken = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
    const factory = new DaiGoldAuction__factory(owner);
    await deployAndMine(
        'DAI_GOLD_AUCTION',
        factory,
        factory.deploy,
        TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
        arbDaiToken,
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