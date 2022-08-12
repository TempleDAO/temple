import balpy
import sys
import os
import json
import jstyleson

if len(sys.argv) < 2:
	print("Usage: python3", sys.argv[0], "create-ascend.json");
	quit();

pathToPool = sys.argv[1];
if not os.path.isfile(pathToPool):
	print("Path", pathToPool, "does not exist. Please enter a valid path.")
	quit();

with open(pathToPool) as f:
	pool = jstyleson.load(f)

gasPriceGweiOverride = pool["gasPriceOverride"];
if gasPriceGweiOverride == "":
	gasPriceGweiOverride = -1;
gasPriceGweiOverride = float(gasPriceGweiOverride);

bal = balpy.balpy.balpy("goerli");
poolId = "4DAD54ED4B0D9F9BDA79ECABD7D3ADCC1D338C9F00020000000000000000009E";

print();
print("==================================================================")
print("=============== Step 4: Add Initial Tokens to Pool ===============")
print("==================================================================")
print();
try:
	txHash = bal.balJoinPoolInit(pool, poolId, gasPriceGweiOverride=gasPriceGweiOverride);
except Exception as e:
	print("Joining pool failed!");
	print("Depending on the pool type, this could be due to you not being the pool owner");
	print("Caught exception:", e);
quit();