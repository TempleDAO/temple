import { ethers } from "hardhat";

export const takeSnapshot = async () => {
  const snapshotId = await ethers.provider.send("evm_snapshot", []);
  return snapshotId;
};

export const revertToSnapshot = async (snapshotId: string) => {
  await ethers.provider.send("evm_revert", [snapshotId]);
};
