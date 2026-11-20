import '@nomiclabs/hardhat-ethers';
import { ComplianceCheck__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);

  const factory = new ComplianceCheck__factory(owner);
  await deployAndMine(
    'COMPLIANCE_CHECK',
    factory,
    factory.deploy,
    await owner.getAddress()
  );
}

runAsyncMain(main);
