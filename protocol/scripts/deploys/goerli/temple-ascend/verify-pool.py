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
creationHash = "0xfde1992598489ef80dc69bde6fefdde94eb5c0071c0e0c0dbde0ccbfa8de6215";
poolId = "4DAD54ED4B0D9F9BDA79ECABD7D3ADCC1D338C9F00020000000000000000009E";

if not creationHash is None:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId, creationHash=creationHash);
else:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId);

print(command)
print()
print("If you need more complete instructions on what to do with this command, go to:");
print("\thttps://dev.balancer.fi/resources/pools/verification");
print()