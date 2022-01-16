import { program } from 'commander'
import fs from 'fs'
import { parseBalanceMap } from './merkle/parse-balance-map'

program
  .version('0.0.0')
  .requiredOption(
    '-i, --input <path>',
    'input JSON file location containing a map of account addresses to string balances'
  )
  .requiredOption(
    '-o, --output <path>',
    'output JSON file location to write resulting merkle root and claims with proofs'
  )

program.parse(process.argv)

const json = JSON.parse(fs.readFileSync(program.opts().input, { encoding: 'utf8' }))

if (typeof json !== 'object') throw new Error('Invalid JSON')

//console.log(JSON.stringify(parseBalanceMap(json)))
fs.writeFileSync(program.opts().output, JSON.stringify(parseBalanceMap(json)))
console.log('done')