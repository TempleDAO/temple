import balpy
import sys
import os
import json
import jstyleson

print("==================================================================")
print("================== Step 5: Verify Pool Contract ==================")
print("==================================================================")
print();

bal = balpy.balpy.balpy("goerli");
creationHash = "0x7e89a8a4f122ae266be5eb19125b837efe28f8a53910d8b99ea1e21b7ec7c57a";
poolId = "fd9d0abd560d3e5da2caf4fc33fdc60d533de19b000200000000000000000091";

if not creationHash is None:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId, creationHash=creationHash);
else:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId);

print(command)
print()
print("If you need more complete instructions on what to do with this command, go to:");
print("\thttps://dev.balancer.fi/resources/pools/verification");
print()