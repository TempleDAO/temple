pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/IStakedTempleVoteToken.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakedTempleVoteToken is IERC20 {
    event StakingSet(address staking);
    event AuthoritySet(address indexed authority, bool authorized);

    error NonTransferrable();
    error NotImplemented();

    function mint(address to, uint256 amount) external;
    /**
     * @dev Destroys a `value` amount of tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 value) external;

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
    function burnFrom(address account, uint256 value) external;

    function pause() external;

    function unpause() external;

    function push(address dst, uint256 wad) external;

    function pull(address src, uint256 wad) external;

    function move(address src, address dst, uint256 amount) external;
}