pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./TempleERC20Token.sol";
import "./TempleTreasury.sol";
import "./TempleStaking.sol";
import "./PresaleAllocation.sol";
import "./LockedOGTemple.sol";

// USDC/USDT/DAI/ETH Zaps
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol';

/**
 * Presale campaign, which lets users to mint and stake based on current IV and a whitelist
 */
contract Presale is Ownable, Pausable {
    IERC20 public STABLEC; // STABLEC contract address
    TempleERC20Token public TEMPLE; // TEMPLE ERC20 contract
    TempleTreasury public TREASURY;
    TempleStaking public STAKING; // Staking contract
    LockedOGTemple public STAKING_LOCK; // contract where OG Temple is locked
    PresaleAllocation public PRESALE_ALLOCATION; // Allocation per address

    // Unlock timestamp. This will change during the presale period, but will always be in a 2 week range.
    uint256 public unlockTimestamp;

    // presale mint multiple
    uint256 public mintMultiple;

    // How much allocation has each user used.
    mapping(address => uint256) public allocationUsed;

    event MintComplete(address minter, uint256 acceptedStablec, uint256 mintedTemple, uint256 mintedOGTemple);

    // USDC/USDT/DAI/ETH Zaps
    ISwapRouter public uniswapRouter;
    IQuoter public quoter;

    constructor(
      IERC20 _STABLEC,
      TempleERC20Token _TEMPLE,
      TempleStaking _STAKING,
      LockedOGTemple _STAKING_LOCK,
      TempleTreasury _TREASURY,
      PresaleAllocation _PRESALE_ALLOCATION,
      uint256 _mintMultiple,
      uint256 _unlockTimestamp,
      ISwapRouter _uniswapRouter,
      IQuoter _quoter) {

      STABLEC = _STABLEC;
      TEMPLE = _TEMPLE;
      STAKING = _STAKING;
      STAKING_LOCK = _STAKING_LOCK;
      TREASURY = _TREASURY;
      PRESALE_ALLOCATION = _PRESALE_ALLOCATION;

      mintMultiple = _mintMultiple;
      unlockTimestamp = _unlockTimestamp;

      uniswapRouter = _uniswapRouter;
      quoter =  _quoter;
    }

    function setUnlockTimestamp(uint256 _unlockTimestamp) external onlyOwner {
      unlockTimestamp = _unlockTimestamp;
    }

    // Zaps (_tokenAddress = address(0) for ETH)
    function mintAndStakeZaps(uint256 _amountTokenIn, address _tokenAddress, uint256 _fraxAmountOutMinimum, bytes memory _path) external payable {
      require((_tokenAddress != address(0) && msg.value == 0) ||  (_tokenAddress == address(0) && msg.value > 0), "ETH only accepted if zapping ETH.");

      if (_tokenAddress != address(0)) {
        SafeERC20.safeTransferFrom(IERC20(_tokenAddress), msg.sender, address(this), _amountTokenIn);
      }

      uint256 _amountIn;

      if (_tokenAddress != address(0)) {
        _amountIn = _amountTokenIn;
      }
      else {
        _amountIn = msg.value;
      }

      ISwapRouter.ExactInputParams memory params =
          ISwapRouter.ExactInputParams({
              path: _path,
              recipient: address(this),
              deadline: block.timestamp,
              amountIn: _amountIn,
              amountOutMinimum: _fraxAmountOutMinimum
          });
      
      uint256 _amountPaidStablec = uniswapRouter.exactInput{ value: msg.value }(params); //Get amount of FRAX returned

      // Everything from here down will be deleted and replaced by a call to OpeningCeremony.mintAndStakeFor (currently unimplemented!)
      (uint256 totalAllocation, uint256 allocationEpoch) = PRESALE_ALLOCATION.allocationOf(msg.sender);

      require(_amountPaidStablec + allocationUsed[msg.sender] <= totalAllocation, "Amount requested exceed address allocation");
      require(allocationEpoch <= STAKING.currentEpoch(), "User's allocated epoch is in the future");

      (uint256 _stablec, uint256 _temple) = TREASURY.intrinsicValueRatio();

      allocationUsed[msg.sender] +=  _amountPaidStablec;
      uint256 _templeMinted = _amountPaidStablec * _temple / _stablec / mintMultiple;
      
      // pull stablec from this contract (after swap) and immediately transfer back to treasury
      SafeERC20.safeTransferFrom(STABLEC, address(this), address(TREASURY), _amountPaidStablec);

      // mint temple and allocate to the staking contract
      TEMPLE.mint(address(this), _templeMinted);
      SafeERC20.safeIncreaseAllowance(TEMPLE, address(STAKING), _templeMinted);

      uint256 amountOgTemple = STAKING.stake(_templeMinted);
      SafeERC20.safeIncreaseAllowance(STAKING.OG_TEMPLE(), address(STAKING_LOCK), amountOgTemple);
      STAKING_LOCK.lockFor(msg.sender, amountOgTemple, unlockTimestamp);

      emit MintComplete(msg.sender, _amountPaidStablec, _templeMinted, amountOgTemple);
    }

    // Do not use on-chain, gas inefficient. Use only for frontend
    function getEstimatedOutput(uint256 _amountTokenIn,  bytes memory _path) external payable returns (uint256) {
      return quoter.quoteExactInput(
          _path,
          _amountTokenIn
      );
    }

    /** mint temple and immediately stake, with a bonus + lockin period */
    function mintAndStake(uint256 _amountPaidStablec) external whenNotPaused {
      (uint256 totalAllocation, uint256 allocationEpoch) = PRESALE_ALLOCATION.allocationOf(msg.sender);

      require(_amountPaidStablec + allocationUsed[msg.sender] <= totalAllocation, "Amount requested exceed address allocation");
      require(allocationEpoch <= STAKING.currentEpoch(), "User's allocated epoch is in the future");

      (uint256 _stablec, uint256 _temple) = TREASURY.intrinsicValueRatio();

      allocationUsed[msg.sender] += _amountPaidStablec;
      uint256 _templeMinted = _amountPaidStablec * _temple / _stablec / mintMultiple;
      
      // pull stablec from staker and immediately transfer back to treasury
      SafeERC20.safeTransferFrom(STABLEC, msg.sender, address(TREASURY), _amountPaidStablec);

      // mint temple and allocate to the staking contract
      TEMPLE.mint(address(this), _templeMinted);
      SafeERC20.safeIncreaseAllowance(TEMPLE, address(STAKING), _templeMinted);

      uint256 amountOgTemple = STAKING.stake(_templeMinted);
      SafeERC20.safeIncreaseAllowance(STAKING.OG_TEMPLE(), address(STAKING_LOCK), amountOgTemple);
      STAKING_LOCK.lockFor(msg.sender, amountOgTemple, unlockTimestamp);

      emit MintComplete(msg.sender, _amountPaidStablec, _templeMinted, amountOgTemple);
    }

    /**
     * Pause contract. Either emergency or at the end of presale
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * Revert pause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}