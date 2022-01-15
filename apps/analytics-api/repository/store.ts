import { Pool, Result } from 'pg';


export class PgDatastore {
    _pool: Pool;

    constructor(){
        this._pool = new Pool({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DATABASE,
            password: process.env.PG_PASSWORD,
            port: process.env.PG_PORT
        }
    )
    }

    async disconnect(){
        await this._pool.end()
    }

    async query(q: string, params?: any[]): Promise<Result>{
        return this._pool.query(q, params)
    }
}

export const pgStore = new PgDatastore()
