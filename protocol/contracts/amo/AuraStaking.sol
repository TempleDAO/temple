pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBaseRewardPool.sol";
import "./interfaces/IAuraBooster.sol";
import "./helpers/AMOCommon.sol";

contract AuraStaking is Ownable {
    using SafeERC20 for IERC20;

    address public operator;

    IERC20 public bptToken;
    AuraPoolInfo public auraPoolInfo;
    IAuraBooster public immutable booster;
    IERC20 public immutable depositToken;

    struct AuraPoolInfo {
        address token;
        address rewards;
        uint32 pId;
    }

    struct Position {
        uint256 staked;
        uint256 earned;
    }

    error NotOperator();
    error NotOperatorOrOwner();

    event SetAuraPoolInfo(uint32, address, address);
    event SetOperator(address);
    event RecoveredToken(address, address, uint256);

    constructor(
        address _operator,
        IERC20 _bptToken,
        IAuraBooster _booster,
        IERC20 _depositToken
    ) {
        operator = _operator;
        bptToken = _bptToken;
        booster = _booster;
        depositToken = _depositToken;
    }

    function setAuraPoolInfo(uint32 _pId, address _token, address _rewards) external onlyOwner {
        auraPoolInfo.pId = _pId;
        auraPoolInfo.token = _token;
        auraPoolInfo.rewards = _rewards;

        emit SetAuraPoolInfo(_pId, _token, _rewards);
    }

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;

        emit SetOperator(_operator);
    }

    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert AMOCommon.InvalidAddress();
        IERC20(token).safeTransfer(to, amount);

        emit RecoveredToken(token, to, amount);
    }

    function depositAndStake(uint256 amount) external onlyOperator {
        bptToken.safeTransferFrom(msg.sender, address(this), amount);

        bptToken.safeIncreaseAllowance(address(booster), amount);
        booster.deposit(auraPoolInfo.pId, amount, true);
    }

    // withdraw deposit token and unwrap to bpt tokens
    function withdrawAndUnwrap(uint256 amount, bool claim, bool sendToOperator) external onlyOperatorOrOwner {
        IBaseRewardPool(auraPoolInfo.rewards).withdrawAndUnwrap(amount, claim);
        if (sendToOperator) {
            // unwrapped amount is 1 to 1
            bptToken.safeTransfer(operator, amount);
        }
    }

    function withdrawAllAndUnwrap(bool claim, bool sendToOperator) external onlyOwner {
        uint256 depositTokenBalance = IBaseRewardPool(auraPoolInfo.rewards).balanceOf(address(this));
        IBaseRewardPool(auraPoolInfo.rewards).withdrawAllAndUnwrap(claim);
        if (sendToOperator) {
            // unwrapped amount is 1 to 1
            bptToken.safeTransfer(operator, depositTokenBalance);
        }
    }

    function getReward(bool claimExtras) external {
        IBaseRewardPool(auraPoolInfo.rewards).getReward(address(this), claimExtras);
    }

    function stakedBalance() public view returns (uint256 balance) {
        balance = IBaseRewardPool(auraPoolInfo.rewards).balanceOf(address(this));
    }

    function earned() public view returns (uint256 earnedRewards) {
        earnedRewards = IBaseRewardPool(auraPoolInfo.rewards).earned(address(this));
    }

    function showPositions() external view returns (Position memory position){
        position.staked = stakedBalance();
        position.earned = earned();
    }

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert NotOperator();
        }
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) {
            revert NotOperatorOrOwner();
        }
        _;
    }
}