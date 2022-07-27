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
creationHash = "0x5aebfdee09e7e9e8a981528ed9e718734b0c5d1905f4d2fdf28d47fd4a8cad63";
poolId = "ae235605a96abaf76c51146b811de480ade3755f000200000000000000000097";

if not creationHash is None:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId, creationHash=creationHash);
else:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId);

print(command)
print()
print("If you need more complete instructions on what to do with this command, go to:");
print("\thttps://dev.balancer.fi/resources/pools/verification");
print()