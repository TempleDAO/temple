pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./RebasingERC20.sol";
import "./Rational.sol";

/**
 * @title Captures the position an account has taken in a given token
 *
 * @dev A position is always valued in one token, and any increase
 * in position due to trading activities is evenly distributed among all
 * token holders
 */
contract Position is Ownable, RebasingERC20 {
    /// @dev The token which this particular strategy is
    /// accounted for in unused other than for information purposes
    IERC20 public revalToken;

    /// @dev total value of all share holders in this strategy
    uint256 public reval;

    /// @dev which actors can increase their stake in a given position
    /// in the temple core, only vaults should hold shares in a position
    mapping(address => bool) public canMint;

    /// @dev actor that can add/remove minters
    address public canManageMinters;

    /// @dev if set, automatically liquidates position and transfers temple
    /// minted as a result to the appropriate vault
    ILiquidator public liquidator;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The default value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(string memory _name, string memory _symbol, ERC20 _revalToken, address _canManageMinters) ERC20(_name, _symbol) { 
        revalToken = _revalToken;
        canManageMinters = _canManageMinters;
    }

    /**
     * @dev increase reval associated with a strategy
     */
    function increaseReval(uint256 amount) external onlyOwner {
        reval += amount;
        //TODO(butlerji): Emit Event
    }

    /**
     * @dev decrease reval associated with a strategy
     */
    function decreaseReval(uint256 amount) external onlyOwner {
        reval -= amount;
        //TODO(butlerji): Emit Event
    }

    /**
     * @dev set actor which automatically liquidates any claimed position into temple
     */
    function setLiqidator(ILiquidator _liquidator) external onlyOwner {
        liquidator = _liquidator;
    }

    /**
     * @dev add a minter to a strategy
     */
    function addMinter(address account) external onlyMinterManager {
        canMint[account] = true;
        //TODO(butlerji): Emit Event
    }

    /**
     * @dev remove a minter from a strategy
     */
    function removeMinter(address account) external onlyMinterManager {
        canMint[account] = false;
        //TODO(butlerji): Emit Event
    }

    /**
     * @notice Generate new strategy shares
     * 
     * @dev Only callable by minters. Increases a minters share of
     * a strategy
     */
    function mint(address account, uint256 amount) external onlyMinter {
        _mint(account, amount);
        reval += amount;
        //TODO(butlerji): Emit Event
    }

    /**
     * @dev Claim the given strategy token holder's share of revenue earned
     * in tokens different from the revalToken
     */
    function claim() external {
        uint256 balance = balanceOf(msg.sender);
        _burn(msg.sender, balance);
        reval -= balance;

        if (address(liquidator) != address(0)) {
            liquidator.toTemple(balance, msg.sender);
        }

        //TODO(butlerji): Event
    }

    function amountPerShare() public view override returns (uint256 p, uint256 q) {
        p = reval;
        q = totalShares;
    }

    /**
     * Throws if called by an actor that cannot mint
     */
    modifier onlyMinter() {
        require(canMint[msg.sender], "Strategy: caller is not a vault");
        _;
    }

    /**
     * Throws if called by an actor that cannot manage minters
     */
    modifier onlyMinterManager() {
        require(msg.sender == canManageMinters || msg.sender == owner(), "Strategy: caller is not a minter or owner");
        _;
    }
}

interface ILiquidator {
    function toTemple(uint256 amount, address toAccount) external view returns (uint256);
}