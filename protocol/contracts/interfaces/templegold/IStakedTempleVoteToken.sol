pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/IStakedTempleVoteToken.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakedTempleVoteToken is IERC20 {
    event StakingSet(address staking);
    event AuthoritySet(address indexed authority, bool authorized);
    event DelegateSet(address indexed from, address prevDelegate, address currentDelegate);

    error NonTransferrable();
    error NotImplemented();

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

    /**  
     * @notice Set authorized contract
     * @dev Aucthorized contract is allowed to transfer/burn vote token
     * @param _authority Contract
     * @param _authorized Bool if authorized
     */
    function setAuthorized(address _authority, bool _authorized) external;

    /**  
     * @notice Set staking contract
     * @param _staking Staking contract
     */
    function setStaking(address _staking) external;

    /**  
     * @notice Mint vote token
     * @dev Only authorized can mint
     * @param to Recipient
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external;

    /**  
     * @notice Get vote weight of an account
     * @param account Account
     */
    function getVoteweight(address account) external view returns (uint256);

    /**  
     * @notice Pause contract
     */
    function pause() external;

    /**  
     * @notice Unpause contract
     */
    function unpause() external;

    /**  
     * @notice Move tokens from caller to dst, specific to Chief DAO contract. src is `msg.sender`
     * @param dst Recipient
     * @param amount Amount
     */
    function push(address dst, uint256 amount) external;

    /**  
     * @notice Pull tokens to caller, specific to Chief DAO contract. recipient is `msg.sender`
     * @param src Source
     * @param amount Amount
     */
    function pull(address src, uint256 amount) external;

    /**    
     * @notice Move tokens from src to dst, specific to Chief DAO contract
     * @param src Source
     * @param dst Destination
     * @param amount Amount
     */
    function move(address src, address dst, uint256 amount) external;
}