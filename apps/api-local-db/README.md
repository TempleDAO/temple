# Temple DB

### Start Dabase
`cd storage && ./startdb.sh`

### Setup Database
This only needs to be done once, after the first time you start it. The postgres data directory in the docker image is mapped to `./storage/pgdata`, so your data will persist across restarts of the db. If you need to reset, remove this folder and re-run setup.

`cd storage && ./setupdb.sh`

### Stop Dabase
`cd storage && ./stopdb.sh`
