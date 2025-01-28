import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import {
  mine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { connectToContracts,
    getPeerInfo, ContractInstances } from '../../mainnet/templegold/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const cartioInfo = getPeerInfo("cartio");
    // showing examples
    // const to = "0xcbc7cf85dd0AB91Aa2671400E86ebf3AaC6dc658";
    // await setPeer(TEMPLE_GOLD_INSTANCES, to, cartioInfo.destEid);
    // await teleport(TEMPLE_GOLD_INSTANCES, cartioInfo.destEid, await owner.getAddress());
}

async function setPeer(instances: ContractInstances, to: string, destEid: number) {
    await mine(instances.TEMPLE_GOLD.TEMPLE_TELEPORTER.setPeer(destEid, addressToBytes32(to)));
}

function addressToBytes32(address: string) {
    return ethers.utils.zeroPad(address, 32);
}

async function teleport(instances: ContractInstances,destEid: number, to: string) {
    const amount = ethers.utils.parseEther("10");
    // bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);
    const options = "0x00030100110100000000000000000000000000030d40";
    await mine(instances.TEMPLE_GOLD.TEMPLE_TELEPORTER.teleport(destEid, to, amount, options, {value:59342083465093}));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });