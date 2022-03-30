const fs = require('fs')
const shell = require('shelljs')

const uncomment = /{required for zap tests}/

const forkBlock = `
       forking: {
         url: \`https://eth-mainnet.alchemyapi.io/v2/\${process.env.ALCHEMY_API_KEY}\`,
       },
`

const hardhatConfigFile = './hardhat.config.ts'
const envFile = '.env'

// Grab config files as they are for easy reset
const config = fs.readFileSync(hardhatConfigFile, 'utf-8')
const env = fs.readFileSync(envFile, 'utf-8')

// Add forking block to the hardhat config file
let addForkBlock = config.replace(uncomment, `${forkBlock}`);
fs.writeFileSync(hardhatConfigFile, addForkBlock)
// Set hardhat to test only the tests that require forked mainnet
fs.appendFileSync(envFile, '\nHARDHAT_TEST_DIRECTORY=./test/forked')

// Run the tests
shell.exec("yarn test")

// Reset back to original state, we were never here :ninja:
fs.writeFileSync(hardhatConfigFile, config)
fs.writeFileSync(envFile, env)