# Temple analytics backend
https://docs.google.com/document/d/1xU3v2WY3kSDGr2iT697kTJf5ZPVAc7k-6NYbLvjPAlc/edit#

[metrics/data model/example endpoints](
https://docs.google.com/spreadsheets/d/14-ZyCYmHp94sGCELO3S-Cdt3-MHp01dVt3BvwrA8GKA/edit#gid=1256935808)

## ETL
### Discord
https://connection.keboola.com will update docs later

## Persistent storage
- Postgresql database supabase.com. Will share credentials later


for development
``` sh
$ docker run --rm --name templedb -p 54321:5432 -v $(pwd)/storage:/tmp/storage -ePOSTGRES_PASSWORD=postgres postgres:14-alpine
$ bash storage/prepare_test_db.sh
```

you can then connect to the db (from node) on port 54321

`npm i pg`

``` sh
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'postgres',
  password: 'postgres',
  port: 54321
});
await pool.connect();
const res = await pool.query('select * from discord_users');
console.log(res.rows[0]);
await pool.end();
```
