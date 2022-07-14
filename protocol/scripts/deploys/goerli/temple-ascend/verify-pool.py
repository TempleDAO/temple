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
creationHash = "0x7f9c4b69f1e002ed7eace713fcc19441b60aad7bc01cf3970f7d4d09e7cbb826";
poolId = "c1e0837cb74bf43f6d77df6199ffff189a65d7c9000200000000000000000075";

if not creationHash is None:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId, creationHash=creationHash);
else:
    command = bal.balGeneratePoolCreationArguments("0x" + poolId);

print(command)
print()
print("If you need more complete instructions on what to do with this command, go to:");
print("\thttps://dev.balancer.fi/resources/pools/verification");
print()