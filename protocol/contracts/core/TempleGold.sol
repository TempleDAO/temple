pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (core/TempleGold.sol)


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/core/ITempleGold.sol";
import { IAuctionEscrow } from "contracts/interfaces/core/IAuctionEscrow.sol";
import { OFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol"; 

/// can use default OAppReceiver and OAppSender

/**
 * @title Temple Gold 
 * @notice Temple Gold is a non-transferrable ERC20 token with LayerZero integration for cross-chain transfer.
 * Temple Gold can be only transferred to or from whitelisted addresses. On mint, Temple Gold is distributed between Staking, Auction and Gnosis Safe 
 * addresses using distribution share percentages set at `DistributionParams`. LayerZero's OFT token standard is modified to allow changing delegates
 * with the same elevated access from v2.
 * @notice 
 */
 contract TempleGold is ITempleGold, OFT, TempleElevatedAccess {

    /// @notice These addresses are mutable to allow change/upgrade.
    /// @notice Staking proxy contract. Staking proxy contract distributes further to Staking contract
    address public stakingProxy;
    /// @notice Escrow auction contract
    IAuctionEscrow public escrow;
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
        address _stakingProxy,
        address _escrow,
        address _gnosis,
        address _layerZeroEndpoint, // local endpoint address
        string memory _name,
        string memory _symbol
    ) OFT(_name, _symbol, _layerZeroEndpoint, _executor) TempleElevatedAccess(_rescuer, _executor) {
       stakingProxy = _stakingProxy;
       escrow = IAuctionEscrow(_escrow);
       teamGnosis = _gnosis;
    }

    /**
     * @notice Set staking proxy contract address
     * @param _stakingProxy Staking proxy contract
     */
    function setStakingProxy(address _stakingProxy) external override onlyElevatedAccess {
        if (_stakingProxy == address(0)) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        stakingProxy = _stakingProxy;
        emit StakingProxySet(_stakingProxy);
    }

    /**
     * @notice Set auctions escrow contract address
     * @param _escrow Auctions escrow contract address
     */
    function setEscrow(address _escrow) external override onlyElevatedAccess {
        if (_escrow == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        escrow = IAuctionEscrow(_escrow);
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
        if (_params.stakingProxy < MINIMUM_DISTRIBUTION_SHARE 
            || _params.escrow < MINIMUM_DISTRIBUTION_SHARE 
            || _params.gnosis < MINIMUM_DISTRIBUTION_SHARE) {
                revert CommonEventsAndErrors.InvalidParam();
            }
        if (_params.stakingProxy + _params.gnosis + _params.escrow != DISTRIBUTION_MULTIPLIER) { revert ITempleGold.InvalidTotalShare(); }
        distributionParams = _params;
        emit DistributionParamsSet(_params.stakingProxy, _params.escrow, _params.gnosis);
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
     * @notice Mint new tokens to be distributed. 
     * Enforces minimum mint amount and uses vestin factor to calculate mint token amount.
     * Minting is only possible on source chain Arbitrum
     */
    function mint() external override onlyElevatedAccess onlyArbitrum {
        VestingFactor memory vestingFactorCache = vestingFactor;
        DistributionParams memory distributionParamsCache = distributionParams;
        if (vestingFactorCache.numerator == 0 || distributionParamsCache.escrow == 0) { revert ITempleGold.MissingParameter(); }
        
        uint256 mintAmount;
        /// @notice first time mint
        if (lastMintTimestamp == 0) {
            mintAmount = (block.timestamp * MAX_SUPPLY * vestingFactorCache.denominator) / vestingFactorCache.numerator;
        } else {
            mintAmount = (lastMintTimestamp - block.timestamp) * (MAX_SUPPLY - totalSupply()) * vestingFactorCache.denominator / vestingFactorCache.numerator;
        }
        if (mintAmount < MINIMUM_MINT) { revert ITempleGold.InsufficientMintAmount(mintAmount); }
        uint256 newTotalSupply = totalSupply() + mintAmount;
        if (newTotalSupply > MAX_SUPPLY) { revert ITempleGold.MaxSupply(); }
        lastMintTimestamp = uint32(block.timestamp);

        _mint(stakingProxy, distributionParamsCache.stakingProxy * mintAmount / DISTRIBUTION_MULTIPLIER);
        _mint(teamGnosis, distributionParamsCache.gnosis * mintAmount / DISTRIBUTION_MULTIPLIER);
        uint256 escrowAmount = distributionParamsCache.escrow * mintAmount / DISTRIBUTION_MULTIPLIER;
        _mint(address(escrow), escrowAmount);
        escrow.checkpointGold(escrowAmount);

        emit Distributed(mintAmount, newTotalSupply, block.timestamp);
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

    /**
     * @notice Get circulating supply across chains
     * @return Circulating supply
     */
    function circulatingSupply() public override view returns (uint256) {
        return totalSupply();
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