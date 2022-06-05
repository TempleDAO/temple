
## getenv.js
This script will get all the environment variables form Vercel and print them to the console. It uses the DAPP projectid, but you must pass in which vercel environmnet variables you want (production or preview)

```
node getenv.js production 

# to save it to a file:
node getenv.js production > .env.vercel.production
```


## setenv.js
This script will set environment variables in Vercel.
It uses the SHADOW project ID. you must pass in the following arguments

```
node setenv.js production .env.vercel.production
```