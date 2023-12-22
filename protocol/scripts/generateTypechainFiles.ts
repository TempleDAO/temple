import { execSync } from 'child_process'
import { existsSync, mkdirSync, readdir } from 'fs'
import path from 'path'

// Directories where the Typechain files will be generated
const outDirSafe = 'typechain/safe/'
const typeChainDirectorySafePath = path.join(__dirname, `../${outDirSafe}`)

const outDirBuild = 'dist/typechain/safe/'
const typeChainDirectoryBuildPath = path.join(__dirname, `../${outDirBuild}`)

const outDirTests = 'typechain/safe/tests/'

// Contract list for which the Typechain files will be generated
// Will be included in dist/ folder
const safeContractsPath = './node_modules/@safe-global/safe-deployments/dist/assets'

const safeContracts_V1_3_0 = [
  `${safeContractsPath}/v1.3.0/gnosis_safe.json`,
  `${safeContractsPath}/v1.3.0/proxy_factory.json`,
  `${safeContractsPath}/v1.3.0/multi_send.json`,
  `${safeContractsPath}/v1.3.0/multi_send_call_only.json`,
  `${safeContractsPath}/v1.3.0/compatibility_fallback_handler.json`,
  `${safeContractsPath}/v1.3.0/sign_message_lib.json`,
  `${safeContractsPath}/v1.3.0/create_call.json`,
  `${safeContractsPath}/v1.3.0/simulate_tx_accessor.json`
].join(' ')

const safeContractsTestV1_3_0Path =
  './node_modules/@gnosis.pm/safe-contracts/build/artifacts/contracts'
const testContracts_V1_3_0 = [
  `${safeContractsTestV1_3_0Path}/examples/guards/DebugTransactionGuard.sol/DebugTransactionGuard.json`,
  `${safeContractsTestV1_3_0Path}/examples/guards/DefaultCallbackHandler.sol/DefaultCallbackHandler.json`
].join(' ')


// Remove existing Typechain files
execSync(`rimraf ${outDirSafe} ${outDirTests}`)

// Generate Typechain files
function generateTypechainFiles(
  typechainVersion: string,
  outDir: string,
  contractList: string
): void {
  const cmd = `typechain --target ${typechainVersion} --out-dir ${outDir} ${contractList}`;
  // console.log('cmd', cmd)
  execSync(cmd)
  console.log(`Generated typechain ${typechainVersion} at ${outDir}`)
}

// Copy Typechain files with the right extension (.d.ts -> .ts) allows them to be included in the build folder
function moveTypechainFiles(inDir: string, outDir: string): void {
  readdir(`${inDir}`, (error, files) => {
    if (error) {
      console.log(error)
    }
    if (!existsSync(`${outDir}`)) {
      mkdirSync(`${outDir}`, { recursive: true })
    }
    files.forEach((file) => {
      const pattern = /.d.ts/
      if (!file.match(pattern)) {
        return
      }
      execSync(`cp ${inDir}/${file} ${outDir}/${file}`)
    })
  })
}

function generateTypes(typechainTarget: string) {
  // Src
  generateTypechainFiles(
    typechainTarget,
    `${outDirSafe}v1.3.0`,
    safeContracts_V1_3_0
  )
  moveTypechainFiles(
    `${typeChainDirectorySafePath}v1.3.0`,
    `${typeChainDirectoryBuildPath}v1.3.0`
  )

  // Tests
  generateTypechainFiles(
    typechainTarget,
    `${outDirTests}v1.3.0`,
    testContracts_V1_3_0
  )
}

generateTypes('ethers-v5')
