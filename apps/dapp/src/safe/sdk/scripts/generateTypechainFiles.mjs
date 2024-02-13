import { execSync } from 'child_process'

// Directories where the Typechain files will be generated
const outDirSafe = 'typechain/safe/'

// Contract list for which the Typechain files will be generated
// Will be included in dist/ folder
const safeContractsPath = '../../node_modules/@safe-global/safe-deployments/dist/assets'

const safeContracts_V1_3_0 = [
  `${safeContractsPath}/v1.3.0/gnosis_safe.json`,
  `${safeContractsPath}/v1.3.0/multi_send.json`,
  `${safeContractsPath}/v1.3.0/multi_send_call_only.json`,
  `${safeContractsPath}/v1.3.0/simulate_tx_accessor.json`
].join(' ')

// Generate Typechain files
function generateTypechainFiles(
  typechainVersion,
  outDir,
  contractList
) {
  const cmd = `typechain --target ${typechainVersion} --out-dir ${outDir} ${contractList}`;
  console.log(`cmd: ${cmd}`);
  execSync(cmd)
  console.log(`Generated typechain ${typechainVersion} at ${outDir}`)
}

function generateTypes(typechainTarget) {
  // Src
  generateTypechainFiles(
    typechainTarget,
    `${outDirSafe}v1.3.0`,
    safeContracts_V1_3_0
  )
}

generateTypes('ethers-v5')
