pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/StakedTempleVoteToken.sol)

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IStakedTempleVoteToken } from "contracts/interfaces/templegold/IStakedTempleVoteToken.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";


/** 
 * @title Staked Temple Vote Token
 * @notice Non-transferrable ERC20 token issued by Temple Gold Staking contract. 
 * StakedTempleVoteToken gives governance power to holders and delegates by enabling voting
 */
contract StakedTempleVoteToken is IStakedTempleVoteToken, TempleElevatedAccess, ERC20, ERC20Burnable, Pausable {

    /// @notice Staking contract. Mutable if ever staking contract is upgraded.
    address public override staking;
    /// @notice Authorized contracts that can burn/mint
    mapping(address authority => bool authorized) public override authorized;
    
    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _staking,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        staking = _staking;
        emit StakingSet(_staking);
    }

    /**  
     * @notice Set staking contract
     * @param _staking Staking contract
     */
    function setStaking(address _staking) external override onlyElevatedAccess {
        if (_staking == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        staking = _staking;
        emit StakingSet(_staking);
    }

    /**  
     * @notice Set authorized contract
     * @dev Aucthorized contract is allowed to transfer/burn vote token
     * @param _authority Contract
     * @param _authorized Bool if authorized
     */
    function setAuthorized(address _authority, bool _authorized) external override onlyElevatedAccess {
        if (_authority == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        authorized[_authority] = _authorized;
        emit AuthoritySet(_authority, _authorized);
    }

    /**  
     * @notice Mint vote token
     * @dev Only authorized can mint
     * @param to Recipient
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external override onlyAuthorized whenNotPaused {
        _mint(to, amount);
    }

    /// @notice override to stop holders burning vote tokens themselves
    function burn(uint256 /*amount*/) public virtual override(IStakedTempleVoteToken, ERC20Burnable) {
        /// @dev not implemented
        revert NotImplemented();
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, deducting from
     * the caller's allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `value`.
     */
    function burnFrom(address account, uint256 value) public virtual override(IStakedTempleVoteToken, ERC20Burnable) onlyAuthorized whenNotPaused {
        _burn(account, value);
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual override(ERC20, IERC20) whenNotPaused returns (bool) {
        return super.transferFrom(from, to, value);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual override(ERC20, IERC20) whenNotPaused returns (bool) {
        return super.transfer(to, value);
    }

     /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual override(ERC20, IERC20) whenNotPaused returns (bool) {
        return super.approve(spender, value);
    }

    /**  
     * @notice Get vote weight of an account
     * @param account Account
     */
    function getVoteweight(address account) external override view returns (uint256) {
        return ITempleGoldStaking(staking).getVoteweight(account);
    }

    /**  
     * @notice Pause contract
     */
    function pause() external onlyElevatedAccess {
        _pause();
    }

    /**  
     * @notice Unpause contract
     */
    function unpause() external onlyElevatedAccess {
        _unpause();
    }

    /**  
     * @notice Move tokens from caller to dst, specific to Chief DAO contract. src is `msg.sender`
     * @param dst Recipient
     * @param amount Amount
     */
    function push(address dst, uint256 amount) external override{
        transferFrom(msg.sender, dst, amount);
    }

    /**  
     * @notice Pull tokens to caller, specific to Chief DAO contract. recipient is `msg.sender`
     * @param src Source
     * @param amount Amount
     */
    function pull(address src, uint256 amount) external override {
        transferFrom(src, msg.sender, amount);
    }

    /**  
     * @notice Move tokens from src to dst, specific to Chief DAO contract
     * @param src Source
     * @param dst Destination
     * @param amount Amount
     */
    function move(address src, address dst, uint256 amount) external override {
        transferFrom(src, dst, amount);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 amount) internal override {
        /// @notice Non-transferrable. Only by staking
        if (from != address(0) && to != address(0)) {
            if(!authorized[from] && !authorized[to]) { revert NonTransferrable(); }
        }
        super._update(from, to, amount);
    }

    modifier onlyAuthorized() {
        if (!authorized[msg.sender]) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}