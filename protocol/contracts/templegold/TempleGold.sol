pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGold.sol)


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Origin } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppReceiver.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { IDaiGoldAuction } from "contracts/interfaces/templegold/IDaiGoldAuction.sol";
import { OFT } from "contracts/templegold/external/layerzero/oft/OFT.sol";
import { ITempleGoldStaking}  from "./../interfaces/templegold/ITempleGoldStaking.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

/// can use default OAppReceiver and OAppSender

/**
 * @title Temple Gold 
 * @notice Temple Gold is a non-transferrable ERC20 token with LayerZero integration for cross-chain transfer.
 * Temple Gold can be only transferred to or from whitelisted addresses. On mint, Temple Gold is distributed between Staking, Auction and Gnosis Safe 
 * addresses using distribution share percentages set at `DistributionParams`. LayerZero's OFT token standard is modified to allow changing delegates
 * with the same elevated access from v2.
 * @notice 
 */
 contract TempleGold is ITempleGold, OFT {

    /// @notice These addresses are mutable to allow change/upgrade.
    /// @notice Staking contract
    ITempleGoldStaking public staking;
    /// @notice Escrow auction contract
    IDaiGoldAuction public escrow;
    /// @notice Multisig gnosis address
    address public teamGnosis;

    /// @notice Last block timestamp Temple Gold was minted
    uint32 public lastMintTimestamp;

    //// @notice Distribution as a percentage of 100
    uint256 public constant DISTRIBUTION_MULTIPLIER = 100 ether;
    /// @notice Minimum percentage of minted Temple Gold to distribute. 1 ether means 1%
    uint256 public constant MINIMUM_DISTRIBUTION_SHARE = 1 ether;
    /// @notice 1B max supply
    uint256 public constant MAX_SUPPLY = 1_000_000_000;
    /// @notice Minimum Temple Gold minted per call to mint
    uint256 public constant MINIMUM_MINT = 1_000;

    /// @notice Whitelisted addresses
    mapping(address => bool) public whitelisted;
    /// @notice Distribution parameters. Minted share percentages for staking, escrow and gnosis. Adds up to 100%
    DistributionParams private distributionParams;
    /// @notice Vesting factor determines rate of mint
    VestingFactor private vestingFactor;
    

    constructor(
        address _rescuer,
        address _executor, // executor is used as delegate in LayerZero Endpoint
        address _staking,
        address _escrow,
        address _gnosis,
        address _layerZeroEndpoint, // local endpoint address
        string memory _name,
        string memory _symbol
    ) OFT(_name, _symbol, _layerZeroEndpoint, _executor) TempleElevatedAccess(_rescuer, _executor) {
       staking = ITempleGoldStaking(_staking);
       escrow = IDaiGoldAuction(_escrow);
       teamGnosis = _gnosis;
    }

    /**
     * @notice Set staking proxy contract address
     * @param _staking Staking proxy contract
     */
    function setStaking(address _staking) external override onlyElevatedAccess {
        if (_staking == address(0)) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        staking = ITempleGoldStaking(_staking);
        emit StakingSet(_staking);
    }

    /**
     * @notice Set auctions escrow contract address
     * @param _escrow Auctions escrow contract address
     */
    function setEscrow(address _escrow) external override onlyElevatedAccess {
        if (_escrow == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        escrow = IDaiGoldAuction(_escrow);
        emit EscrowSet(_escrow);
    }

    /**
     * @notice Set team gnosis address
     * @param _gnosis Team gnosis address
     */
    function setTeamGnosis(address _gnosis) external override onlyElevatedAccess {
        if (_gnosis == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        teamGnosis = _gnosis;
        emit TeamGnosisSet(_gnosis);
    }

    /**
     * @notice Whitelist an address to allow transfer of Temple Gold to or from
     * @param _contract Contract address to whitelist
     * @param _whitelist Boolean whitelist state
     */
    function whitelistContract(address _contract, bool _whitelist) external override onlyElevatedAccess {
        if (_contract == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        whitelisted[_contract] = _whitelist;
        emit ContractWhitelisted(_contract, _whitelist);
    } 

    /**
     * @notice Set distribution percentages of newly minted Temple Gold
     * @param _params Distribution parameters
     */
    function setDistributionParams(DistributionParams calldata _params) external override onlyElevatedAccess {
        if (_params.staking < MINIMUM_DISTRIBUTION_SHARE 
            || _params.escrow < MINIMUM_DISTRIBUTION_SHARE 
            || _params.gnosis < MINIMUM_DISTRIBUTION_SHARE) {
                revert CommonEventsAndErrors.InvalidParam();
            }
        if (_params.staking + _params.gnosis + _params.escrow != DISTRIBUTION_MULTIPLIER) { revert ITempleGold.InvalidTotalShare(); }
        distributionParams = _params;
        emit DistributionParamsSet(_params.staking, _params.escrow, _params.gnosis);
    }

    /**
     * @notice Set vesting factor
     * @param _factor Vesting factor
     */
    function setVestingFactor(VestingFactor calldata _factor) external override onlyElevatedAccess {
        if (_factor.numerator == 0 || _factor.denominator == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_factor.numerator > _factor.denominator) { revert CommonEventsAndErrors.InvalidParam(); }
        vestingFactor = _factor;
        emit VestingFactorSet(_factor.numerator, _factor.denominator);
    }
    
    /**
     * @notice Mint new tokens to be distributed. Open to call from any address
     * Enforces minimum mint amount and uses vesting factor to calculate mint token amount.
     * Minting is only possible on source chain Arbitrum
     */
    function mint() external override onlyArbitrum {
        VestingFactor memory vestingFactorCache = vestingFactor;
        DistributionParams storage distributionParamsCache = distributionParams;
        if (vestingFactorCache.numerator == 0 || distributionParamsCache.escrow == 0) { revert ITempleGold.MissingParameter(); }
        
        uint256 mintAmount = _getMintAmount(vestingFactorCache);
        if (mintAmount < MINIMUM_MINT) { revert ITempleGold.InsufficientMintAmount(mintAmount); }
        uint256 totalSupplyCache = totalSupply();
        if (totalSupplyCache >= MAX_SUPPLY) { revert MaxSupply(); }

        uint256 newTotalSupply = totalSupplyCache + mintAmount;
        if (newTotalSupply > MAX_SUPPLY) {
            mintAmount = MAX_SUPPLY - totalSupplyCache;
        }

        lastMintTimestamp = uint32(block.timestamp);

        _distribute(distributionParamsCache, mintAmount);
    }

    function _distribute(DistributionParams storage params, uint256 mintAmount) private {
        uint256 stakingAmount = _mulDivRound(params.staking, mintAmount, DISTRIBUTION_MULTIPLIER, false);
        if (stakingAmount > 0) {
            _mint(address(staking), stakingAmount);
            staking.notifyDistribution(stakingAmount);
        }

        uint256 escrowAmount = _mulDivRound(params.escrow, mintAmount, DISTRIBUTION_MULTIPLIER, false);
        if (escrowAmount > 0) {
            _mint(address(escrow), escrowAmount);
            escrow.notifyDistribution(escrowAmount);
        }

        uint256 gnosisAmount = _mulDivRound(params.gnosis, mintAmount, DISTRIBUTION_MULTIPLIER, false);
        if (gnosisAmount > 0) {
            _mint(teamGnosis, gnosisAmount);
            /// @notice no requirement to notify gnosis because no action has to be taken
        }
        
        emit Distributed(stakingAmount, escrowAmount, gnosisAmount, block.timestamp);
    }

    /**
     * @notice Get vesting factor
     * @return Vesting factor
     */
    function getVestingFactor() external override view returns (VestingFactor memory) {
        return vestingFactor;
    }

    /**
     * @notice Get distribution parameters
     * @return Distribution parametersr
     */
    function getDistributionParameters() external override view returns (DistributionParams memory) {
        return distributionParams;
    }

    function _getMintAmount(VestingFactor memory vestingFactorCache) private view returns (uint256 mintAmount) {
        /// @notice first time mint
        if (lastMintTimestamp == 0) {
            mintAmount = _mulDivRound(block.timestamp * MAX_SUPPLY, vestingFactorCache.denominator, vestingFactorCache.numerator, false);
        } else {
            mintAmount = _mulDivRound((lastMintTimestamp - block.timestamp) * (MAX_SUPPLY - totalSupply()), vestingFactorCache.denominator, vestingFactorCache.numerator, false);
        }
    }

    function canDistribute() external view returns (bool) {
        VestingFactor memory vestingFactorCache = vestingFactor;
        uint256 mintAmount = _getMintAmount(vestingFactorCache);
        return mintAmount >= MINIMUM_MINT && totalSupply() < MAX_SUPPLY;
    }

    /**
     * @notice Get circulating supply across chains
     * @return Circulating supply
     */
    function circulatingSupply() public override view returns (uint256) {
        return totalSupply();
    }

   function isComposeMsgSender(
        Origin calldata _origin,
        bytes calldata _message,
        address _sender
    ) external view returns (bool isSender) {

    }

    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function _mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    function _beforeTokenTransfer(address from, address to /*uint256 amount*/) internal view {
        /// @notice can only transfer to or from whitelisted addreess
        /// this also disables burn
        if (from != address(0) || to != address(0)) {
            if (!whitelisted[from] && !whitelisted[to]) { revert ITempleGold.NonTransferrable(from, to); }
        }
    }

    modifier onlyArbitrum() {
        _;
    }
 }