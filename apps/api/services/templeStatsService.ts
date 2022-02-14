import axios from 'axios'
import { AxiosResponse } from 'axios'

export class TempleStatsService {
    subgraphUrl: string

    constructor(subgraphUrl: string){
        this.subgraphUrl = subgraphUrl
    }

    // Make GraphQL query
    async query(gqlQuery: string){
        const gqlQueryObj =  {query: gqlQuery}
        return await axios.post(this.subgraphUrl, gqlQueryObj)
    }

    public async getTotalSupply(): Promise<number>{
        const gqlQuery = `{
     protocolMetrics(first:1, orderBy: timestamp, orderDirection: desc) {
       templeSupply
     }
}`
        const resp = await this.query(gqlQuery)
        const totalSupply =  Number(resp.data.data?.protocolMetrics[0]?.templeSupply)
        if (!totalSupply) throw new Error(`Subgraph returned unexpected data ${JSON.stringify(resp.data)}`)
        return totalSupply
    }
}

export const templeStats = new TempleStatsService(process.env.TEMPLE_SUBGRAPH_URL)
