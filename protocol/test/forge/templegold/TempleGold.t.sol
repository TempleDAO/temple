pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGold.t.sol)

import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract TempleGoldTestBase is TempleGoldCommon {
    using OptionsBuilder for bytes;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event ContractAuthorizationSet(address indexed _contract, bool _whitelisted);
    event VestingFactorSet(uint128 value, uint128 weekMultiplier);
    event DistributionParamsSet(uint256 staking, uint256 daiGoldAuction, uint256 gnosis);
    event Distributed(uint256 stakingAmount, uint256 daiGoldAuctionAmount, uint256 gnosisAmount, uint256 timestamp);
    event StakingSet(address staking);
    event DaiGoldAuctionSet(address daiGoldAuction);
    event TeamGnosisSet(address gnosis);
    event CirculatingSupplyUpdated(address indexed sender, uint256 amount, uint256 circulatingSuppply, uint256 totalBurned);
    event NotifierSet(address indexed notifier);

    DaiGoldAuction public daiGoldAuction;
    TempleGoldStaking public staking;
    TempleGold public templeGold;
    TempleGold public templeGoldMainnet;
    FakeERC20 public templeToken;

    uint32 internal _setVestingFactorTime;

    uint256 public constant MINIMUM_DISTRIBUTION_SHARE = 1 ether;
    uint256 public constant ARBITRUM_ONE_BLOCKNUMBER_B = 207201713;
    uint256 public constant MINIMUM_MINT = 1_000;
    uint256 public constant MAXIMUM_CIRCULATING_SUPPLY = 1_000_000_000 ether;
    uint256 public arbitrumOneForkId;
    uint256 public mainnetForkId;

    function setUp() public {
        arbitrumOneForkId = fork("arbitrum_one");

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        templeGold = new TempleGold(initArgs);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold));
        daiGoldAuction = new DaiGoldAuction(
            address(templeGold),
            daiToken,
            treasury,
            rescuer,
            executor,
            executor
        );
        vm.startPrank(executor); 
        _configureTempleGold();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(templeGold.owner(), executor);
        assertEq(address(templeGold.daiGoldAuction()), address(daiGoldAuction));
        assertEq(address(templeGold.staking()), address(staking));
        assertEq(templeGold.teamGnosis(), teamGnosis);
        assertEq(templeGold.MAX_CIRCULATING_SUPPLY(), 1_000_000_000 ether);
    }

    function _configureTempleGold() private {
        templeGold.setDaiGoldAuction(address(daiGoldAuction));
        ITempleGold.DistributionParams memory params;
        params.daiGoldAuction = 60 ether;
        params.gnosis = 10 ether;
        params.staking = 30 ether;
        templeGold.setDistributionParams(params);
        ITempleGold.VestingFactor memory factor;
        factor.value = 2 ether;
        factor.weekMultiplier = 1000 ether;
        templeGold.setVestingFactor(factor);
        _setVestingFactorTime = uint32(block.timestamp);
        templeGold.setStaking(address(staking));
        templeGold.setTeamGnosis(address(teamGnosis));
        // whitelist
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function _deployContractsOnMainnet() internal returns (TempleGold){
        mainnetForkId = fork("mainnet");
        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        initArgs.layerZeroEndpoint = layerZeroEndpointEthereum;
        templeGoldMainnet = new TempleGold(initArgs);
        return templeGoldMainnet;
    }

    function _setupPeers() internal {
        templeGoldMainnet = _deployContractsOnMainnet();
        vm.startPrank(executor);
        vm.selectFork(mainnetForkId);
        templeGoldMainnet.setPeer(ARBITRUM_ONE_LZ_EID, _addressToBytes32(address(templeGold)));
        vm.selectFork(arbitrumOneForkId);
        templeGold.setPeer(MAINNET_LZ_EID, _addressToBytes32(address(templeGoldMainnet)));
        vm.stopPrank();
    }
}

contract TempleGoldAccessTest is TempleGoldTestBase {
    function test_access_setaiGoldAuction_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.setDaiGoldAuction(alice);
    }

    function test_access_setStaking_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.setStaking(alice);
    }

    function test_access_setTeamGnosis_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.setTeamGnosis(teamGnosis);
    }

    function test_access_authorizeContract_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.authorizeContract(alice, true);
    }

    function test_access_setDistributionParams_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.setDistributionParams(_getDistributionParameters());
    }

    function test_access_setVestingFactor_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.setVestingFactor(_getVestingFactor());
    }
}

contract TempleGoldViewTest is TempleGoldTestBase {
    function test_oftVersion_tgld() public {
        (bytes4 interfaceId, ) = templeGold.oftVersion();
        bytes4 expectedId = 0x02e49c2c;
        assertEq(interfaceId, expectedId);
    }

    function test_getVestingFactor_tgld() public {
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);
        _factor = templeGold.getVestingFactor();
        assertEq(_factor.value, 10 ether);
        assertEq(_factor.weekMultiplier, 100 ether);
        _factor.value = 3 ether;
        templeGold.setVestingFactor(_factor);
        _factor = templeGold.getVestingFactor();
        assertEq(_factor.value, 3 ether);
        assertEq(_factor.weekMultiplier, 100 ether);
    }

    function test_getDistributionParameters_tgld() public {
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        vm.startPrank(executor);
        _params.staking = 50 ether;
        _params.daiGoldAuction = 40 ether;
        _params.gnosis = 10 ether;
        templeGold.setDistributionParams(_params);
        _params = templeGold.getDistributionParameters();
        assertEq(_params.staking, 50 ether);
        assertEq(_params.daiGoldAuction, 40 ether);
        assertEq(_params.gnosis, 10 ether);
    }

    function test_canDistribute_tgld() public {
        _setVestingFactor(templeGold);
        bool canDistribute = templeGold.canDistribute();
        assertEq(canDistribute, false);
        skip(1 days);
        canDistribute = templeGold.canDistribute();
        assertEq(canDistribute, true);
        templeGold.mint();
        // end of vesting
        skip(99 days);
        canDistribute = templeGold.canDistribute();
        assertEq(canDistribute, true);
        templeGold.mint();
        canDistribute = templeGold.canDistribute();
        assertEq(canDistribute, false);
    }

    function test_getMintAmount_tgld() public {
        // first mint
        ITempleGold.VestingFactor memory _factor = templeGold.getVestingFactor();
        _factor.value = 1 seconds;
        _factor.weekMultiplier = 100 days;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);
        uint256 _maxSupply = templeGold.MAX_CIRCULATING_SUPPLY();
        uint256 _amount = _maxSupply * (block.timestamp - _setVestingFactorTime) * _factor.value / _factor.weekMultiplier;
        assertEq(_amount, templeGold.getMintAmount());
        templeGold.mint();
        uint256 _lastMint = block.timestamp;
        skip(10 days);
        _amount = (block.timestamp - _lastMint) * _maxSupply * _factor.value / _factor.weekMultiplier;
        assertEq(_amount, templeGold.getMintAmount());
        assertEq(templeGold.circulatingSupply(), templeGold.totalSupply());
        uint256 _circulating =  _amount + templeGold.totalSupply();
        templeGold.mint();
        assertEq(_circulating, templeGold.circulatingSupply());
    }
}

contract TempleGoldTest is TempleGoldTestBase {

    function test_setStaking_tgld() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        templeGold.setStaking(address(0));

        vm.expectEmit(address(templeGold));
        emit StakingSet(address(staking));
        templeGold.setStaking(address(staking));
        assertEq(address(templeGold.staking()), address(staking));
        vm.expectEmit(address(templeGold));
        emit StakingSet(alice);
        templeGold.setStaking(alice);
        assertEq(address(templeGold.staking()), alice);
    }

    function test_setdaiGoldAuction_tgld() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        templeGold.setDaiGoldAuction(address(0));

        vm.expectEmit(address(templeGold));
        emit DaiGoldAuctionSet(address(daiGoldAuction));
        templeGold.setDaiGoldAuction(address(daiGoldAuction));
        assertEq(address(templeGold.daiGoldAuction()), address(daiGoldAuction));
        vm.expectEmit(address(templeGold));
        emit DaiGoldAuctionSet(alice);
        templeGold.setDaiGoldAuction(alice);
        assertEq(address(templeGold.daiGoldAuction()), alice);
    }

    function test_setTeamGnosis_tgld() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        templeGold.setTeamGnosis(address(0));

        vm.expectEmit(address(templeGold));
        emit TeamGnosisSet(teamGnosis);
        templeGold.setTeamGnosis(teamGnosis);
        assertEq(templeGold.teamGnosis(), teamGnosis);
        vm.expectEmit(address(templeGold));
        emit TeamGnosisSet(alice);
        templeGold.setTeamGnosis(alice);
        assertEq(templeGold.teamGnosis(), alice);
    }

    function test_authorizeContract_tgld() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        templeGold.authorizeContract(address(0), false);

        address daiGoldAuction = address(daiGoldAuction);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(daiGoldAuction, true);
        templeGold.authorizeContract(daiGoldAuction, true);
        assertEq(templeGold.authorized(daiGoldAuction), true);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(daiGoldAuction, false);
        templeGold.authorizeContract(daiGoldAuction, false);
        assertEq(templeGold.authorized(daiGoldAuction), false);
    }

    function test_setVestingFactor_tgld() public {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        uint128 temp = _factor.value;
        _factor.value = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        templeGold.setVestingFactor(_factor);
        _factor.value = temp;
        temp = _factor.weekMultiplier;
        _factor.weekMultiplier = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        templeGold.setVestingFactor(_factor);
        _factor.weekMultiplier = temp;
        vm.expectEmit(address(templeGold));
        emit VestingFactorSet(_factor.value, _factor.weekMultiplier);
        templeGold.setVestingFactor(_factor);
        ITempleGold.VestingFactor memory _vf = templeGold.getVestingFactor();
        assertEq(_vf.value, 10 ether);
        assertEq(_vf.weekMultiplier, 100 ether);
        assertEq(templeGold.lastMintTimestamp(), uint32(block.timestamp));
    }

    function test_setDistributionParameters_tgld() public {
        vm.startPrank(executor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();

        _params.gnosis = _params.gnosis + 1;
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.InvalidTotalShare.selector));
        templeGold.setDistributionParams(_params);

        _params.gnosis = _params.gnosis - 1;
        vm.expectEmit(address(templeGold));
        emit DistributionParamsSet(_params.staking, _params.daiGoldAuction, _params.gnosis);
        templeGold.setDistributionParams(_params);

        ITempleGold.DistributionParams memory _p = templeGold.getDistributionParameters();
        assertEq(_p.gnosis, _params.gnosis);
        assertEq(_p.daiGoldAuction, _params.daiGoldAuction);
        assertEq(_p.staking, _params.staking);
    }

    function test_mint_tgld_revert() public {
        // cannot mint on different chain
        templeGoldMainnet = _deployContractsOnMainnet();
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.WrongChain.selector));
        templeGoldMainnet.mint();
    }

    function test_nontransferrable_tgld() public {
        vm.startPrank(executor);
        templeGold.authorizeContract(teamGnosis, false);
        vm.warp(block.timestamp + 2 days);
        templeGold.mint();
        vm.startPrank(teamGnosis);
        uint256 balance = templeGold.balanceOf(teamGnosis);
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, teamGnosis, alice));
        templeGold.transfer(alice, balance);

    }

    function test_mint_tgld_recipient_params_revert() public {
        vm.selectFork(arbitrumOneForkId);
        // minting when params and vesting factor not set
        fork("arbitrum_one");

        TempleGold _templeGold = new TempleGold(_getTempleGoldInitArgs());
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.MissingParameter.selector));
        _templeGold.mint();
        ITempleGold.VestingFactor memory _factor;
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        _templeGold.setVestingFactor(_factor);
        _templeGold.setDistributionParams(_getDistributionParameters());
        skip(1 days);
        // invalid receiver. staking and daiGoldAuction not set
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        _templeGold.mint();
    }

    function test_mint_with_vesting_factor_one_year() public {
        vm.selectFork(arbitrumOneForkId);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);
        uint256 mintAmount = templeGold.getMintAmount();
        assertEq(mintAmount, 0);

        // week 1
        uint256 timeDifference = 1 weeks;
        uint256 emission = (timeDifference * MAXIMUM_CIRCULATING_SUPPLY / _factor.value) / _factor.weekMultiplier;
        skip(1 weeks);
        mintAmount = templeGold.getMintAmount();
        templeGold.mint();
        emit log_string("Emission 1");
        emit log_uint(emission);
        assertEq(emission, mintAmount);
        assertEq(emission, templeGold.circulatingSupply());
        assertEq(templeGold.circulatingSupply(), 28571428571428571428571428);
        uint256 totalEmissions = emission;
        // week 2
        skip(1 weeks);
        emission = (timeDifference * (MAXIMUM_CIRCULATING_SUPPLY - totalEmissions) / _factor.value) / _factor.weekMultiplier;
        mintAmount = templeGold.getMintAmount();
        totalEmissions += emission;
        templeGold.mint();
        emit log_string("Emission 2");
        emit log_uint(emission);
        emit log_uint(totalEmissions);
        assertEq(emission, mintAmount);
        assertEq(totalEmissions, templeGold.circulatingSupply());
        assertEq(templeGold.circulatingSupply(), 56326530612244897959183672);

        // week 3
        skip(1 weeks);
        emission = (timeDifference * (MAXIMUM_CIRCULATING_SUPPLY - totalEmissions) / _factor.value) / _factor.weekMultiplier;
        mintAmount = templeGold.getMintAmount();
        totalEmissions += emission;
        templeGold.mint();
        emit log_string("Emission 3");
        emit log_uint(emission);
        emit log_uint(totalEmissions);
        assertEq(emission, mintAmount);
        assertEq(totalEmissions, templeGold.circulatingSupply());
        assertEq(templeGold.circulatingSupply(), 83288629737609329446064138);

        // week 4
        skip(1 weeks);
        emission = (timeDifference * (MAXIMUM_CIRCULATING_SUPPLY - totalEmissions) / _factor.value) / _factor.weekMultiplier;
        mintAmount = templeGold.getMintAmount();
        totalEmissions += emission;
        templeGold.mint();
        emit log_string("Emission 4");
        emit log_uint(emission);
        emit log_uint(totalEmissions);
        assertEq(emission, mintAmount);
        assertEq(totalEmissions, templeGold.circulatingSupply());
        assertEq(templeGold.circulatingSupply(), 109480383173677634319033734);

        // // week 5
        skip(1 weeks);
        emission = (timeDifference * (MAXIMUM_CIRCULATING_SUPPLY - totalEmissions) / _factor.value) / _factor.weekMultiplier;
        mintAmount = templeGold.getMintAmount();
        totalEmissions += emission;
        templeGold.mint();
        emit log_string("Emission 5");
        emit log_uint(emission);
        emit log_uint(totalEmissions);
        assertEq(emission, mintAmount);
        assertEq(totalEmissions, templeGold.circulatingSupply());
        assertEq(templeGold.circulatingSupply(), 134923800797286844767061341);

        // week 6
        skip(1 weeks);
        emission = (timeDifference * (MAXIMUM_CIRCULATING_SUPPLY - totalEmissions) / _factor.value) / _factor.weekMultiplier;
        mintAmount = templeGold.getMintAmount();
        totalEmissions += emission;
        templeGold.mint();
        emit log_string("Emission 6");
        emit log_uint(emission);
        emit log_uint(totalEmissions);
        assertEq(emission, mintAmount);
        assertEq(totalEmissions, templeGold.circulatingSupply());
    }

    function test_mint_tgld_share() public {
        vm.selectFork(arbitrumOneForkId);
        uint256 totalSupply = templeGold.totalSupply();
        _setVestingFactor(templeGold);

        skip(1 days);
        uint256 mintAmount = templeGold.getMintAmount();
        ITempleGold.DistributionParams memory _params = templeGold.getDistributionParameters();
        uint256 stakingAmount = _params.staking * mintAmount / 100 ether;
        uint256 daiGoldAuctionAmount = _params.daiGoldAuction * mintAmount / 100 ether;
        uint256 gnosisAmount = mintAmount - (stakingAmount + daiGoldAuctionAmount);
        
        vm.expectEmit(address(templeGold));
        emit Transfer(address(0), address(staking), stakingAmount);
        vm.expectEmit(address(templeGold));
        emit Transfer(address(0), address(daiGoldAuction), daiGoldAuctionAmount);
        vm.expectEmit(address(templeGold));
        emit Transfer(address(0), teamGnosis, gnosisAmount);
        vm.expectEmit(address(templeGold));
        emit Distributed(stakingAmount, daiGoldAuctionAmount, gnosisAmount, block.timestamp);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldAuctionAmount);
        assertEq(templeGold.balanceOf(teamGnosis), gnosisAmount);
        // end of vesting
        totalSupply = templeGold.totalSupply();
        skip(99 days);
        mintAmount = templeGold.getMintAmount();
        stakingAmount = _params.staking * mintAmount / 100 ether;
        daiGoldAuctionAmount = _params.daiGoldAuction * mintAmount / 100 ether;
        gnosisAmount = mintAmount - (stakingAmount + daiGoldAuctionAmount);

        uint256 stakingBalanceBefore = templeGold.balanceOf(address(staking));
        uint256 daiGoldAuctionBalanceBefore = templeGold.balanceOf(address(daiGoldAuction));
        uint256 gnosisBalanceBefore = templeGold.balanceOf(teamGnosis);
        templeGold.mint();
        emit log_string("balances 2");
        emit log_uint(templeGold.balanceOf(address(staking)));
        emit log_uint(templeGold.balanceOf(address(daiGoldAuction)));
        emit log_uint(mintAmount);
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingBalanceBefore+stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldAuctionBalanceBefore+daiGoldAuctionAmount);
        assertEq(templeGold.balanceOf(teamGnosis), gnosisBalanceBefore+gnosisAmount);
        // test mint amount = 0
        assertEq(templeGold.getMintAmount(), 0);
        // test coverage mintAmount = 0
        templeGold.mint();
    }

    function test_mint_tgld_distribution() public {
        vm.selectFork(arbitrumOneForkId);
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor;
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(_factor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        _params.gnosis = 0;
        _params.staking = 30 ether;
        _params.daiGoldAuction = 70 ether;
        skip(30 days);
        uint256 totalSupply = templeGold.totalSupply();
        uint256 mintAmount = templeGold.getMintAmount();
        templeGold.setDistributionParams(_params);
        uint256 stakingAmount = _params.staking * mintAmount / 100 ether;
        uint256 gnosisAmount = 0;
        uint256 daiGoldAuctionAmount = _params.daiGoldAuction * mintAmount / 100 ether;
        emit log_string("gnosis amount");
        emit log_uint(templeGold.balanceOf(teamGnosis));
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldAuctionAmount);
        assertApproxEqAbs(templeGold.balanceOf(teamGnosis), gnosisAmount, 1);

        // staking = 0
        _params.gnosis = 10 ether;
        _params.staking = 0;
        _params.daiGoldAuction = 90 ether;
        templeGold.setDistributionParams(_params);
        skip(30 days);
        mintAmount = templeGold.getMintAmount();
        totalSupply = templeGold.totalSupply();
        stakingAmount = 0;
        gnosisAmount = _params.gnosis * mintAmount / 100 ether;
        daiGoldAuctionAmount = _params.daiGoldAuction * mintAmount / 100 ether;
        uint256 stakingBalance = templeGold.balanceOf(address(staking));
        uint256 daiGoldBalance = templeGold.balanceOf(address(daiGoldAuction));
        uint256 gnosisBalance = templeGold.balanceOf(teamGnosis);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingBalance+stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldBalance+daiGoldAuctionAmount);
        assertApproxEqAbs(templeGold.balanceOf(teamGnosis), gnosisBalance+gnosisAmount, 1);

        // dai gold auction = 0
        _params.gnosis = 10 ether;
        _params.staking = 90 ether;
        _params.daiGoldAuction = 0;
        templeGold.setDistributionParams(_params);
        skip(30 days);
        mintAmount = templeGold.getMintAmount();
        totalSupply = templeGold.totalSupply();
        stakingAmount = _params.staking * mintAmount / 100 ether;
        gnosisAmount = _params.gnosis * mintAmount / 100 ether;
        daiGoldAuctionAmount = 0;
        stakingBalance = templeGold.balanceOf(address(staking));
        daiGoldBalance = templeGold.balanceOf(address(daiGoldAuction));
        gnosisBalance = templeGold.balanceOf(teamGnosis);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingBalance+stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldBalance+daiGoldAuctionAmount);
        assertApproxEqAbs(templeGold.balanceOf(teamGnosis), gnosisBalance+gnosisAmount, 1);
    }

    function test_mint_max_supply_tgld() public {
        // set vesting factor high to speed max supply mint time
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 35;
        templeGold.setVestingFactor(_factor);
        skip(5 days);
        uint256 _expectedAmount = templeGold.getMintAmount();
        _expectedAmount = templeGold.MAX_CIRCULATING_SUPPLY() - templeGold.totalSupply();

        ITempleGold.DistributionParams memory _params = templeGold.getDistributionParameters();
        uint256 stakingAmount = _params.staking * _expectedAmount / 100 ether;
        uint256 gnosisAmount = _params.gnosis * _expectedAmount / 100 ether;
        uint256 daiGoldAuctionAmount = _params.daiGoldAuction * _expectedAmount / 100 ether;
        vm.expectEmit(address(templeGold));
        emit Distributed(stakingAmount, daiGoldAuctionAmount, gnosisAmount, block.timestamp); 
        templeGold.mint();

        uint256 _totalSupply = templeGold.totalSupply();
        assertEq(_totalSupply, templeGold.MAX_CIRCULATING_SUPPLY());
        assertEq(templeGold.canDistribute(), false);
        // nothing is minted
        templeGold.mint();
        assertEq(templeGold.totalSupply(), _totalSupply);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), _totalSupply);
        assertEq(templeGold.getMintAmount(), 0);
    }
}