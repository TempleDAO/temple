pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IFaith.sol";

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributor {
    // Returns the merkle root of the merkle tree containing account balances available to claim.
    function merkleRoot() external view returns (bytes32);
    // Returns true if the index has been marked claimed.
    function isClaimed(uint256 index) external view returns (bool);
    // Claim the given amount of the token to the given address. Reverts if the inputs are invalid.
    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external;

    // This event is triggered whenever a call to #claim succeeds.
    event Claimed(uint256 index, address account, uint256 amount);
}

contract FaithMerkleAirdrop is IMerkleDistributor {
  using SafeERC20 for IERC20;
  using Address for address;

  address public owner;
  IFaith public immutable faith;
  
  uint256 claimStartTime;
  uint256 claimEndTime;
  bytes32 public immutable override merkleRoot;

  // This is a packed array of booleans.
  mapping(uint256 => uint256) private claimedBitMap;

  constructor(IFaith _faith, bytes32 _merkleRoot) {
    owner = msg.sender;
    faith = _faith;
    merkleRoot = _merkleRoot;
  }

  function setOwner(address _newOwner) external {
    require(msg.sender == owner, "not owner");
    require(_newOwner != address(0), "address zero");
    owner = _newOwner;
  }

  function setClaimStartTime(uint256 _claimStartTime) external {
    require(msg.sender == owner, "not owner");
    require(_claimStartTime >= block.timestamp, "invalid time");
    claimStartTime = _claimStartTime;
  }

  function setClaimEndTime(uint256 _claimEndTime) external {
    require(msg.sender == owner, "not owner");
    require(claimStartTime < _claimEndTime && _claimEndTime > block.timestamp, "invalid time");
    claimEndTime = _claimEndTime;
  }

  function getClaimPeriod() external view returns (uint256, uint256) {
    return (claimStartTime, claimEndTime);
  }

  function isClaimed(uint256 index) public view override returns (bool) {
    uint256 claimedWordIndex = index / 256;
    uint256 claimedBitIndex = index % 256;
    uint256 claimedWord = claimedBitMap[claimedWordIndex];
    uint256 mask = (1 << claimedBitIndex);
    return claimedWord & mask == mask;
  }

  function _setClaimed(uint256 index) private {
    uint256 claimedWordIndex = index / 256;
    uint256 claimedBitIndex = index % 256;
    claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
  }

  function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external override {
    require(block.timestamp >= claimStartTime && block.timestamp < claimEndTime, "invalid claim period");
    require(!isClaimed(index), 'MerkleDistributor: Drop already claimed.');

    // Verify the merkle proof.
    bytes32 node = keccak256(abi.encodePacked(index, account, amount));
    require(MerkleProof.verify(merkleProof, merkleRoot, node), 'MerkleDistributor: Invalid proof.');

    // Mark it claimed and send the token.
    _setClaimed(index);

    faith.gain(account, uint112(amount));

    emit Claimed(index, account, amount);
  }
}