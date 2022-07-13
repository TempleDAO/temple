//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title A generic claim contract, with vesting, using a merkle tree to specify wallets and amounts
 * @dev works with rebasing tokens, so can use to distribute vaulted temple
 * @author butlerji
 */
contract MerkleTreeClaim is Ownable, Pausable {
    /// @dev when the vesting starts
    uint256 public immutable vestingStartTimestamp;

    /// @dev vesting cliff duration
    uint256 public immutable vestingCliffDuration;

    /// @dev how long is the vesting period
    uint256 public immutable vestingDuration;

    /// @dev Token being claimed
    IERC20 public immutable claimToken;

    /// @dev merkle tree root of (address, claimShare)
    bytes32 public immutable claimShareMerkleRoot;

    /// @dev total shares yet to be claimed. Expect the following condition
    /// to always hold sum(originalShares) - sum(claimedShares) == totalUnclaimedShares
    uint256 public totalUnclaimedShares;

    /// @dev shares claimed by a given account
    mapping(address => uint256) public claimedShares;

    event Claimed(address account, uint256 sharesClaimedToDate, uint256 sharesClaimedInTx, uint256 amountTokensTransferred);

    constructor(
        uint256 _vestingStartTimestamp,
        uint256 _vestingCliffDuration,
        uint256 _vestingDuration,
        IERC20 _claimToken,
        bytes32 _claimShareMerkleRoot,
        uint256 _totalUnclaimedShares
    ) {
        vestingStartTimestamp = _vestingStartTimestamp;
        vestingDuration = _vestingDuration;
        vestingCliffDuration = _vestingCliffDuration;
        claimToken = _claimToken;
        claimShareMerkleRoot = _claimShareMerkleRoot;
        totalUnclaimedShares = _totalUnclaimedShares;
    }

    /**
     * @notice claim `share` of token `purchaseToken` for this Round. Requires valid `amount` as per `inviteCode`
     */
    function claimFor(address account, uint256 share, bytes32[] calldata merkleProof) external {
        require(account != address(0), "MerkleTreeClaim: Address cannot be 0x0");
        require(MerkleProof.verify(merkleProof, claimShareMerkleRoot, keccak256(abi.encode(account, share))), "MerkleTreeClaim: Invalid claim");

        (uint256 totalVestedShares, uint256 unclaimdVestedShares, uint256 amountTokensClaimed) = calculateClaimable(account, share, block.timestamp);

        claimedShares[account] += unclaimdVestedShares;
        totalUnclaimedShares -= unclaimdVestedShares;

        SafeERC20.safeTransfer(claimToken, account, amountTokensClaimed);
        emit Claimed(account, totalVestedShares, unclaimdVestedShares, amountTokensClaimed);
    }

    /// @dev Calculates the claimable amount for a given account in a given timestamp
    /// @param account Account to get data from
    /// @param timestamp => can be used to calculate claimable amount in a time other than block.timestamp
    function calculateClaimable(address account, uint256 share, uint256 timestamp) public view returns (uint256 totalVestedShares, uint256 unclaimdVestedShares, uint256 amountTokensClaimed)
    {
        if (timestamp < vestingStartTimestamp) {
            return (0,0,0);
        }

        uint256 currentVestingDuration = timestamp - vestingStartTimestamp;
        if (currentVestingDuration < vestingCliffDuration) {
            return (0,0,0);
        }

        totalVestedShares = share * currentVestingDuration / vestingDuration;
        if (totalVestedShares > share) {
            totalVestedShares = share;
        }
        unclaimdVestedShares = totalVestedShares - claimedShares[account];

        amountTokensClaimed = unclaimdVestedShares * claimToken.balanceOf(address(this)) / totalUnclaimedShares;
    }

    /**
     * @dev toggle pause. Escape hatch in the event an incorrect contract is deployed.
     */
    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    /**
    * @dev transfer out amount of token to provided address. Escape hatch in the event an incorrect
    * contract is deployed.
    */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to address zero");

        if (token == address(0)) {
            (bool sent,) = payable(to).call{value: amount}("");
            require(sent, "send failed");
        } else {
            SafeERC20.safeTransfer(IERC20(token), to, amount);
        }
    }
}
