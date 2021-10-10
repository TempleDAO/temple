pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./TempleERC20Token.sol";
import "./ITreasuryAllocation.sol";

/**
 * Turn on if we need a campaign to defend the temple/DAI price
 */
contract TreasuryInvestmentDefend is Ownable, ITreasuryAllocation {
    IERC20 public DAI; // DAI contract address
    TempleERC20Token public TEMPLE; // The token being staked, for which TEMPLE rewards are generated
    address public treasury; // Managing treasury contract

    mapping(address => uint256) public staked;

    // Total rewards per temple staked if user decides to withdraw dai
    uint256 public daiRewardsPerShare; 

    // total temple currently staked
    uint256 public totalStaked; 

    // Last block by which a temple user can join the defend campaign
    uint256 public campaignJoinEndBlock;

    // Block which signfies the end of the staking period
    uint256 public campaignStakingEndBlock;

    event StakeCompleted(address _staker, uint256 _amount);
    event TempleRestaked(address _staker, uint256 _amount);
    event DaiClaimed(address _staker, uint256 _dai, uint256 _temple);

    constructor(
      address _DAI,
      address _TEMPLE,
      address _treasury,
      uint256 _daiRewardsPerShare,
      uint256 _campaignJoinPeriod,
      uint256 _campaignStakingPeriod) {

      require(_treasury != address(0));

      DAI = IERC20(_DAI);
      TEMPLE = TempleERC20Token(_TEMPLE);
      daiRewardsPerShare = _daiRewardsPerShare;
      campaignJoinEndBlock = block.number + _campaignJoinPeriod;
      campaignStakingEndBlock = campaignJoinEndBlock + _campaignStakingPeriod;

      treasury = _treasury;
    }

    function reval() public view override returns (uint256) {
      return DAI.balanceOf(address(this));
    }

    /** 
     * Closeout defend campaign. Any user that hasn't elected to withdraw rewards in DAI, at this point
     * can only withdraw rewards in TEMPLE.
     */
    function closeout() external onlyOwner {
      SafeERC20.safeTransfer(DAI, treasury, reval());
    }

    /** get balance of a certain users' stake */
    function getUserBalance(address _staker) external view returns(uint256 _amountStaked) {
        return staked[_staker];
    }

    /** lets a user stake tokens we accept */
    function stake(uint256 _amount) external {
        require(_amount > 0, "Can not stake 0 tokens");
        require(block.number < campaignJoinEndBlock, "Can no longer join defend campaign");
        require(totalStaked * daiRewardsPerShare < DAI.balanceOf(address(this)), "Defend campaign has reached capacity");

        staked[msg.sender] = staked[msg.sender] + _amount;
        totalStaked = totalStaked + _amount;

        SafeERC20.safeTransferFrom(TEMPLE, msg.sender, address(this), _amount);
        emit StakeCompleted(msg.sender, _amount);
    }

    // TODO(jeeva): Make this re-stake.
    function withdrawTemple() external {        
        uint256 _deposited = staked[msg.sender];

        require(_deposited > 0, "User has no stake");
        require(block.number < campaignStakingEndBlock, "defend campaign still in progress");

        staked[msg.sender] = 0;
        totalStaked -= _deposited;

        SafeERC20.safeTransfer(TEMPLE, msg.sender, _deposited);
        emit TempleRestaked(msg.sender, _deposited);
    }

    function withdrawDai() external {        
        uint256 _deposited = staked[msg.sender];

        require(_deposited > 0, "User has no stake");
        require(block.number < campaignStakingEndBlock, "defend campaign still in progress");

        staked[msg.sender] = 0;
        totalStaked -= _deposited;

        uint256 _daiClaimed = _deposited * daiRewardsPerShare;
        SafeERC20.safeTransfer(DAI, msg.sender, _daiClaimed);
        TEMPLE.burn(_deposited);
        emit DaiClaimed(msg.sender,  _daiClaimed, _deposited);
    }
}