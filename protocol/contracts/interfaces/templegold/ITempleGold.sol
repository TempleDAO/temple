pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ITempleGold.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IOFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import { IOAppCore } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppCore.sol";
import { IOAppOptionsType3 } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import { IDaiGoldAuction } from "contracts/interfaces/templegold/IDaiGoldAuction.sol";

interface ITempleGold is IOFT, IOAppCore, IOAppOptionsType3, IERC20 {
    struct DistributionParams {
        /// @notice staking contract
        uint256 staking;
        /// @notice DAI_TGLD auction contract
        uint256 escrow;
        /// @notice Team gnosis
        uint256 gnosis;
    }

    struct VestingFactor {
        uint128 numerator;
        uint128 denominator;
    }

    /// @notice To avoid stack too deep in constructor
    struct InitArgs {
        address executor; // executor is also used as delegate in LayerZero Endpoint
        address staking;
        address escrow;
        address gnosis;
        address layerZeroEndpoint; // local endpoint address
        uint256 mintChainId;
        string name;
        string symbol;
    }

    event ContractAuthorizationSet(address indexed _contract, bool _whitelisted);
    event VestingFactorSet(uint128 numerator, uint128 denominator);
    event DistributionParamsSet(uint256 staking, uint256 escrow, uint256 gnosis);
    event Distributed(uint256 stakingAmount, uint256 escrowAmount, uint256 gnosisAmount, uint256 timestamp);
    event StakingSet(address staking);
    event EscrowSet(address escrow);
    event TeamGnosisSet(address gnosis);
    
    error InvalidTotalShare();
    error MissingParameter();
    error NonTransferrable(address from, address to);
    error WrongChain();
    error CannotCompose();

    /// @notice These addresses are mutable to allow change/upgrade.
    /// @notice Staking contract
    function staking() external view returns (ITempleGoldStaking);

    /// @notice Escrow auction contract
    function escrow() external view returns (IDaiGoldAuction);

    /// @notice Multisig gnosis address
    function teamGnosis() external view returns (address);

    /// @notice Last block timestamp Temple Gold was minted
    function lastMintTimestamp() external view returns (uint32);

    /// @notice Whitelisted addresses for transferrability
    function authorized(address who) external view returns (bool);

    /**
     * @notice Set staking proxy contract address
     * @param _staking Staking proxy contract
     */
    function setStaking(address _staking) external;

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
    function authorizeContract(address _contract, bool _whitelist) external;

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

    /**
     * @notice Check if TGOLD can be distributed
     * @return True if can distribtue
     */
    function canDistribute() external view returns (bool);

    /**
     * @notice Get amount of TGLD tokens that will mint if `mint()` called
     * @return Mint amount
     */
    function getMintAmount() external view returns (uint256);
}