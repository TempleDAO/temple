import { assert } from 'chai';
import { TempleStatsService } from './templeStatsService'

const {TEMPLE_SUBGRAPH_URL} = process.env

describe('subgraph service', function (){
    this.timeout(15000)
    it('Gives total supply', async () => {

        const stats = new TempleStatsService(TEMPLE_SUBGRAPH_URL)
        const supply = await stats.getTotalSupply()
        assert.isAbove(supply, 0)
    })
})
