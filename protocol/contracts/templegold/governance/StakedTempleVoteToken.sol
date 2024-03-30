pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/governance/StakedTempleVoteToken.sol)

import { IERC20, ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Wrapper } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
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

    event StakingSet(address staking);

    error NonTransferrable();
    
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

    function burn(address from, uint256 amount) external onlyStaking {
        _burn(from, amount);
    }

    // The functions below are overrides required by Solidity.

    function decimals() public view override returns (uint8) {
        return super.decimals();
    }

    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
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

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    // function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
    //     /// @notice Non-transferrable
    //     if (from != address(0)) { revert NonTransferrable(); }
    //     if (to != address(0)) { revert NonTransferrable(); }
    // }

    modifier onlyStaking() {
        if (msg.sender != staking) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}