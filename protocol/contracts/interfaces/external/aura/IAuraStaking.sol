pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/external/aura/IAuraStaking.sol)

interface IAuraStaking {
    function rewardsRecipient() external view returns (address);
    
    function setAuraPoolInfo(uint32 _pId, address _token, address _rewards) external;

    function setOperator(address _operator) external;

    function recoverToken(address token, address to, uint256 amount) external;

    function depositAndStake(uint256 amount) external;

    function depositAllAndStake() external;

    function withdrawAll(bool claim, bool sendToOperator) external;

    function withdraw(uint256 amount, bool claim, bool sendToOperator) external;

    function withdrawAndUnwrap(uint256 amount, bool claim, address to) external;

    function withdrawAllAndUnwrap(bool claim, bool sendToOperator) external;

    function getReward(bool claimExtras) external;

    function stakedBalance() external view returns (uint256);

    function earned() external view returns (uint256);

    /**
     * @notice The total balance of BPT owned by this contract - either staked in Aura 
     * or unstaked
     */
    function totalBalance() external view returns (uint256);
}