import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTeamPayments__factory } from '../../../typechain';
import {
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  expectAddressWithPrivateKey,
  toAtto,
} from '../helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`);
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  // Set gasPrice manually instead of using deployAndMine/mine()
  const gasPrice = ethers.utils.parseUnits('34', 'gwei');

  const templeTeamPaymentsFactory = new TempleTeamPayments__factory(owner);
  const startDate = Math.round(Date.now() / 1000);
  const templeTeamPayments = await templeTeamPaymentsFactory.deploy(
    DEPLOYED.TEMPLE,
    10, // although no vesting, but has to be at least 1 second vesting else division by zero error
    startDate,
    {
      gasPrice,
    }
  );
  console.log(
    `Deployed... waiting for transaction to mine: ${templeTeamPayments.deployTransaction.hash}`
  );
  await templeTeamPayments.deployed();
  console.log('Contract deployed');
  console.log(
    `yarn hardhat verify --network ${network.name} ${templeTeamPayments.address} ${DEPLOYED.TEMPLE} 10 ${startDate}`
  );

  const allocs: { [address: string]: number } = {
    '0x056c7b90255cA73EF674F75d9653bB5d947c4C9E': 1500,
    '0x06e6F9DE62afa6F2Ca092Fe17fF57dAc3Ae30db1': 8500,
    '0x072d76b501E364FCA58B6A7fe16a88c74D64924c': 500,
    '0x08e19c5B9667FA2d49A6709482aa5aC0C4a7b198': 2200,
    '0x09D65b16F0FB469a1Cab065d0060a9dFA89dabe1': 1550,
    '0x0F9fd136c773fbe39E4F05440d5448ca8cBe457c': 8869,
    '0x228900C0263B6Ac19E66fF491E30c83d3473a2d8': 2050,
    '0x248e5c90143E6E283E5c45387b10D91049C390c8': 600,
    '0x27E9578BD639A2876636A0DDEfFeb7bd4b539003': 240,
    '0x294A29Ad8842E7234EE16B1b16f1F98747B715Eb': 150,
    '0x2acfd61F1ccbE5F8fF1fF34a6eC2958685b8Fc89': 2000,
    '0x2c90982BEc7A5aD00A65ce87C4F62263A3055cBB': 4268,
    '0x387a652c87A2571b93EF4dECc61BEB74A5970582': 1001,
    '0x3AC87eD1BEDB341f97656d5f24EDDEf7Fc810811': 3464,
    '0x49F29f02947F609f1b3779A293B106215d4434d5': 9774,
    '0x4e51F68940FaC327B2f018B6b79109031031fe8b': 1200,
    '0x5245859F78bb510aB9c8A4Ce74506Ec1F7D24DD3': 1700,
    '0x54120e6f4379A525AcC5aE7DBbf6758c271b8b15': 12146,
    '0x588282ADA5B9D872d0eBF506c5C1b541e2a60BBa': 10122,
    '0x5a71Db7011bE6452CE46bEb8b14e9bdBA0F781Cb': 2150,
    '0x62370003cEbacd6415d32375095FFc8AB7238eBC': 1200,
    '0x6581fcfe9864bCD6Cf7015B2c435cF20E6d731E9': 904,
    '0x71e41D0dFeA7ca196c7B104F01EfFd1102af9694': 24264,
    '0x73E29Bb563592610a4DdDfbeEFC0259E3A27e410': 300,
    '0x779731032c24356199a7baaFae20f4271c0Ccc80': 4800,
    '0x7f068d2890bD5ce602DCB9d040515306d067cA02': 2490,
    '0x832d7aed44ff0396770Be2F2f3603153A8c787E9': 1500,
    '0x87997a32A5Ba852D95CFC7c803B3b3371B223aE2': 1000,
    '0x8B81e8E65B9BA652A8F8455062BFe4930929d7D1': 850,
    '0x8BBF709345fA5f6FDB451f95D398EBbCE1750A51': 200,
    '0x8CC8bA612168B5A8cBefb977D7DE7375A61A1009': 6500,
    '0x9743b92460fC79F070D2059D6C533bE84A1dd493': 4600,
    '0xA0483f29E325108A34c2A385c999C2FeF08d4Af7': 1500,
    '0xA1D0Ff488595Eb262c086A344421a43717F8fCAF': 1000,
    '0xbCB921901a212E9876DB73fa32C8d92aCB6AAbF8': 3000,
    '0xd8a9cC702Eb55cF13460e04d51F8b836867Ef333': 5061,
    '0xDC884904D07d201c54D1aa5D0AD509E4eE289eAe': 600,
    '0xDCeC3b61fFB8b946A5c07129F3855adDc7077ad6': 1750,
    '0xe107f0FfB7FBC701b00CEcc3E8d003339E271b93': 1340,
    '0xe345e9605391c13Fd2502e7141D54b752AaDB184': 5861,
    '0xe5D74520A77EDaa6Fff050975775213FA01948c9': 11145,
    '0xE9e073dC07bd0a7b825108683b5ac095dD2eCE60': 9928,
    '0xECD71BAF7F3113324fA03391ce78accBebAbe190': 2450,
    '0xF225d51037eBcC32B3347184A89a10F1FF3e58df': 1000,
    '0xF94A14fdEbf75007329E50f0aC9f459fF566B157': 700,
    '0xF9B4De4bB735ACE677813ac8E24B6530B2D595E9': 1200,
    '0xfED4FEd3C90C4e93D203D25EF2B148C863b68356': 5350,
  };

  console.log('Setting allocations');
  const tx1 = await templeTeamPayments.setAllocations(
    Object.keys(allocs),
    Object.values(allocs).map((a) => toAtto(a)),
    {
      gasPrice,
    }
  );
  await tx1.wait();
  console.log('Mined');

  console.log('Transferring owner');
  const tx2 = await templeTeamPayments.transferOwnership(DEPLOYED.MULTISIG, {
    gasPrice,
  });
  await tx2.wait();
  console.log('Mined');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
