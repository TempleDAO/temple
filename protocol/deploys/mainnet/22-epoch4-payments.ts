import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTeamPayments, TempleTeamPayments__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, expectAddressWithPrivateKey, mine, toAtto } from '../helpers';

async function main() {
  
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const templeTeamPaymentsFactory = new TempleTeamPayments__factory(owner);
  const templeTeamFixedPayments: TempleTeamPayments = await deployAndMine(
    'TEMPLE_TEAM_EPOCH_4', templeTeamPaymentsFactory, templeTeamPaymentsFactory.deploy,
    DEPLOYED.TEMPLE,
    10, // although no vesting, but has to be at least 1 second vesting else division by zero error
    Math.round(Date.now()/1000)
  )

  const allocs : [string, number][] = [
    ["0x072d76b501E364FCA58B6A7fe16a88c74D64924c",47101],
    ["0xe52918e16F254f6bc12aeD964E3C4A4DC802995e",57971],
    ["0xE6bf9bbA3C4812c14aDC671023768b3F03A14C7C",50725],
    ["0x269c304025Af54dD9e275845786eA0506eA83874",123188],
    ["0x45240F9f4A88fEbe023E43014d03E8Ce1f308d03",108696],
    ["0x40809850c91f815b31518F8F7D4D97a1bF3A2CCA",7246],
    ["0xc74fE043A56f29B647033E3CD1a8044b3e79B151",543],
    ["0x900cb99922971d3963baD2Aac0808ea38a0F3c8F",543],
    ["0x913a5793EB4081e06Aa6744ad0705F89D46999C3",72464],
    ["0x387a652c87A2571b93EF4dECc61BEB74A5970582",30435],
    ["0x35df342eBD5dc7706497350b297852DFeA927Ebb",30435],
    ["0x73E29Bb563592610a4DdDfbeEFC0259E3A27e410",15217],
    ["0xF94A14fdEbf75007329E50f0aC9f459fF566B157",24348],
    ["0xc9dF34a5d86330a09bAa53dB69f9BEbdD5D0146c",18261],
    ["0xAB4EDBd86ab484019dA2136E884d284398a2f442",6087],
    ["0x4A19A34F1a1aE76A659f8ae4A9c76F270De84e45",24348],
    ["0x7958324897F4B38338b95A800A933801009d6814",6087],
    ["0x76CC407aA36bc13DC453d1CC8da433233d5f127D",9130],
    ["0x0c9C3Ba64072eb566b0E9A4B6Bb0D7B204d68469",9130],
    ["0x0044efC842264E8FB01b6A62d5E479a83b2Fd26d",21304],
    ["0x45A7c62f2ba4a31D07B28f81BF63c67968b0eFB9",3043],
    ["0x389E3d1c46595aF7335F8C6D3e403ce2E8a9cf8A",9130],
    ["0xDEe65679dEa368d358555b8bBA2eB90DD811b5d0",21304],
    ["0xAE56b8029C5545CAd69c931ec71aAaF5174F80EF",14493],
    ["0xEE742B54559B2971149DF3d88F642f11891509eb",65217],
    ["0x08e19c5B9667FA2d49A6709482aa5aC0C4a7b198",28986],
    ["0x0F511FE5Dcdb54b0b19A5A2a57E76977Ae728C15",43478],
    ["0x1a856a0e6A63e289582FaF9b96E05Ab1406e6b07",28986],
    ["0x2acfd61F1ccbE5F8fF1fF34a6eC2958685b8Fc89",28986],
    ["0x90E23D451a716bF25987F055E3E57c1384337fDe",10145],
    ["0x3C1E397d428281F156F8fa733Ba160Faa2baB946",86957],
    ["0x06e6F9DE62afa6F2Ca092Fe17fF57dAc3Ae30db1",10145],
    ["0xF2c3767ca40575B2BFea2E4F78bbB75CCe321867",94203],
    ["0x64cd423852Cd62F5E0B532740b5E5C771EC3Dea4",86957],
    ["0x54120e6f4379A525AcC5aE7DBbf6758c271b8b15",108696],
    ["0xA91dE3AD5EEFc5c26a61401782B4F38a87DeE9d1",72464],
    ["0xf042adfBd62bEB51221B9fDAF41Eeef56fF83F0e",72464],
    ["0xF70801aa3E89Eb5c1Fc624eD94A58CcB24c400Ea",72464],
    ["0xE0bb475Ef181168dFF18D2BD7d1C147d4dc502F9",28986],
    ["0xF2E1A88af3D6cDdD60B9c43CeE53d655cBa40b2c",21739],
    ["0x35093a15f7310459821E597b074443b6aFC3D8C2",14493],
    ["0xD79B5F20D2701e9cbD7891D942BccCF043a4AAe7",43478],
    ["0x588282ADA5B9D872d0eBF506c5C1b541e2a60BBa",36232],
    ["0x00Fb1b6aDAAdE37A4DcF9fa92456A612180FD193",36232],
    ["0x1b13C989488D7954A7baBAeec9320347422ca1dE",36232],
    ["0x4931cFb8dF2F1C20339DFc78237579cdEc1af3bf",21739],
    ["0x3e32aE8663B93a950510A949eCbD72c4343C5a09",14493],
    ["0x3AC87eD1BEDB341f97656d5f24EDDEf7Fc810811",50725],
    ["0xB122F96F40203ed018E0F17126dDdD0D79855c8a",14493],
    ["0xF9B4De4bB735ACE677813ac8E24B6530B2D595E9",8696],
    ["0xE241e9c5ad983dF9e97cF342F6fC891bE0DE2169",12319],
    ["0xd50Df43803DD8ff6c268103794fa9E061Fee487b",21739]
  ];

  await mine(templeTeamFixedPayments.setAllocations(
    allocs.map(a => a[0]),
    allocs.map(a => toAtto(a[1])),
  ));

  await mine(templeTeamFixedPayments.transferOwnership(DEPLOYED.MULTISIG))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });