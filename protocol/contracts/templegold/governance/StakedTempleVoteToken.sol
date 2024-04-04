pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/governance/StakedTempleVoteToken.sol)

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IStakedTempleVoteToken } from "contracts/interfaces/templegold/IStakedTempleVoteToken.sol";


/** 
 * @title Staked Temple Vote Token
 * @notice Non-transferrable ERC20 token issued by Temple Gold Staking contract. StakedTempleVoteToken gives governance power to holders by enabling voting
 */

contract StakedTempleVoteToken is IStakedTempleVoteToken, TempleElevatedAccess, ERC20, ERC20Burnable, ERC20Permit, ERC20Votes {

    /// @notice Staking contract. Mutable if ever staking contract is upgraded.
    address public staking;
    
    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _staking,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) ERC20Permit(_name) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        staking = _staking;
        emit StakingSet(_staking);
    }

    function setStaking(address _staking) external onlyElevatedAccess {
        if (_staking == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        staking = _staking;
        emit StakingSet(_staking);
    }

    function mint(address to, uint256 amount) external onlyStaking {
        _mint(to, amount);
    }

    function burn(uint256 /*amount*/) public virtual override(IStakedTempleVoteToken, ERC20Burnable) onlyStaking {
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
    function burnFrom(address account, uint256 value) public virtual override(IStakedTempleVoteToken, ERC20Burnable) onlyStaking {
        _burn(account, value);
    }

    // The functions below are overrides required by Solidity.

    function decimals() public view override returns (uint8) {
        return super.decimals();
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        /// @notice Non-transferrable. Only by staking
        if(from != staking && to!= staking) { revert NonTransferrable(); }
        super._update(from, to, amount);
    }

    function nonces(address owner) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    // Overrides IERC6372 functions to make the token & governor timestamp-based

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }   

    modifier onlyStaking() {
        if (msg.sender != staking) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}