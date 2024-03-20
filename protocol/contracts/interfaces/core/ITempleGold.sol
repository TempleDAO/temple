pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/core/ITempleGold.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITempleGold is IERC20 {
    struct DistributionParams {
        uint256 stakingProxy;
        uint256 escrow;
        uint256 gnosis;
    }

    struct VestingFactor {
        uint128 numerator;
        uint128 denominator;
    }

    event ContractWhitelisted(address indexed _contract, bool _whitelisted);
    event VestingFactorSet(uint128 numerator, uint128 denominator);
    event DistributionParamsSet(uint256 staking, uint256 escrow, uint256 gnosis);
    event Distributed(uint256 amount, uint256 totalSupply, uint256 timestamp);
    event StakingProxySet(address stakingProxy);
    event EscrowSet(address escrow);
    event TeamGnosisSet(address gnosis);
    
    error InvalidTotalShare();
    error MissingParameter();
    error InsufficientMintAmount(uint256 amount);
    error NonTransferrable(address from, address to);
    error MaxSupply();
    

    /**
     * @notice Set staking proxy contract address
     * @param _stakingProxy Staking proxy contract
     */
    function setStakingProxy(address _stakingProxy) external;

    /**
     * @notice Set auctions escrow contract address
     * @param _escrow Auctions escrow contract address
     */
    function setEscrow(address _escrow) external;

    /**
     * @notice Set team gnosis address
     * @param _gnosis Team gnosis address
     */
    function setTeamGnosis(address _gnosis) external;

    /**
     * @notice Whitelist an address to allow transfer of Temple Gold to or from
     * @param _contract Contract address to whitelist
     * @param _whitelist Boolean whitelist state
     */
    function whitelistContract(address _contract, bool _whitelist) external;

    /**
     * @notice Set distribution percentages of newly minted Temple Gold
     * @param _params Distribution parameters
     */
    function setDistributionParams(DistributionParams calldata _params) external;

    /**
     * @notice Set vesting factor
     * @param _factor Vesting factor
     */
    function setVestingFactor(VestingFactor calldata _factor) external;

    /**
     * @notice Mint new tokens to be distributed. 
     * Enforces minimum mint amount and uses vestin factor to calculate mint token amount.
     * Minting is only possible on source chain Arbitrum
     */
    function mint() external;

    /**
     * @notice Get vesting factor
     * @return Vesting factor
     */
    function getVestingFactor() external view returns (VestingFactor memory);

    /**
     * @notice Get distribution parameters
     * @return Distribution parametersr
     */
    function getDistributionParameters() external view returns (DistributionParams memory);

    /**
     * @notice Get circulating supply across chains
     * @return Circulating supply
     */
    function circulatingSupply() external view returns (uint256);
}