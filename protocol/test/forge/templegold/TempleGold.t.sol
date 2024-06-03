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
    event VestingFactorSet(uint128 numerator, uint128 denominator);
    event DistributionParamsSet(uint256 staking, uint256 escrow, uint256 gnosis);
    event Distributed(uint256 stakingAmount, uint256 escrowAmount, uint256 gnosisAmount, uint256 timestamp);
    event StakingSet(address staking);
    event EscrowSet(address escrow);
    event TeamGnosisSet(address gnosis);

    DaiGoldAuction public daiGoldAuction;
    TempleGoldStaking public staking;
    TempleGold public templeGold;
    TempleGold public templeGoldMainnet;
    FakeERC20 public templeToken;

    uint32 internal _setVestingFactorTime;

    uint256 public constant MINIMUM_DISTRIBUTION_SHARE = 1 ether;
    uint256 public constant ARBITRUM_ONE_BLOCKNUMBER_B = 207201713;
    uint256 public constant MINIMUM_MINT = 1_000;
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
            executor
        );
        vm.startPrank(executor);
        templeGold.setEscrow(address(daiGoldAuction)); 
        _configureTempleGold();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(templeGold.owner(), executor);
        assertEq(address(templeGold.escrow()), address(daiGoldAuction));
        assertEq(address(templeGold.staking()), address(staking));
        assertEq(templeGold.teamGnosis(), teamGnosis);
        assertEq(templeGold.MAX_SUPPLY(), 1_000_000_000 ether);
    }

    function _configureTempleGold() private {
        ITempleGold.DistributionParams memory params;
        params.escrow = 60 ether;
        params.gnosis = 10 ether;
        params.staking = 30 ether;
        templeGold.setDistributionParams(params);
        ITempleGold.VestingFactor memory factor;
        factor.numerator = 2 ether;
        factor.denominator = 1000 ether;
        templeGold.setVestingFactor(factor);
        _setVestingFactorTime = uint32(block.timestamp);
        templeGold.setStaking(address(staking));
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
    function test_access_setEscrow_tgld() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
        templeGold.setEscrow(alice);
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
        assertEq(_factor.numerator, 10 ether);
        assertEq(_factor.denominator, 100 ether);
        _factor.numerator = 3 ether;
        templeGold.setVestingFactor(_factor);
        _factor = templeGold.getVestingFactor();
        assertEq(_factor.numerator, 3 ether);
        assertEq(_factor.denominator, 100 ether);
    }

    function test_getDistributionParameters_tgld() public {
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        vm.startPrank(executor);
        _params.staking = 50 ether;
        _params.escrow = 40 ether;
        _params.gnosis = 10 ether;
        templeGold.setDistributionParams(_params);
        _params = templeGold.getDistributionParameters();
        assertEq(_params.staking, 50 ether);
        assertEq(_params.escrow, 40 ether);
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
        _factor.numerator = 1 seconds;
        _factor.denominator = 100 days;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);
        uint256 _maxSupply = templeGold.MAX_SUPPLY();
        uint256 _amount = _maxSupply * (block.timestamp - _setVestingFactorTime) * _factor.numerator / _factor.denominator;
        assertEq(_amount, templeGold.getMintAmount());
        templeGold.mint();
        uint256 _lastMint = block.timestamp;
        skip(10 days);
        _amount = (block.timestamp - _lastMint) * _maxSupply * _factor.numerator / _factor.denominator;
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

    function test_setEscrow_tgld() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        templeGold.setEscrow(address(0));

        vm.expectEmit(address(templeGold));
        emit EscrowSet(address(daiGoldAuction));
        templeGold.setEscrow(address(daiGoldAuction));
        assertEq(address(templeGold.escrow()), address(daiGoldAuction));
        vm.expectEmit(address(templeGold));
        emit EscrowSet(alice);
        templeGold.setEscrow(alice);
        assertEq(address(templeGold.escrow()), alice);
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

        address escrow = address(daiGoldAuction);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(escrow, true);
        templeGold.authorizeContract(escrow, true);
        assertEq(templeGold.authorized(escrow), true);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(escrow, false);
        templeGold.authorizeContract(escrow, false);
        assertEq(templeGold.authorized(escrow), false);
    }

    function test_setVestingFactor_tgld() public {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        uint128 temp = _factor.numerator;
        _factor.numerator = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        templeGold.setVestingFactor(_factor);
        _factor.numerator = temp;
        temp = _factor.denominator;
        _factor.denominator = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        templeGold.setVestingFactor(_factor);
        _factor.denominator = _factor.numerator - 1;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeGold.setVestingFactor(_factor);
        _factor.denominator = temp;
        vm.expectEmit(address(templeGold));
        emit VestingFactorSet(_factor.numerator, _factor.denominator);
        templeGold.setVestingFactor(_factor);
        ITempleGold.VestingFactor memory _vf = templeGold.getVestingFactor();
        assertEq(_vf.numerator, 10 ether);
        assertEq(_vf.denominator, 100 ether);
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
        emit DistributionParamsSet(_params.staking, _params.escrow, _params.gnosis);
        templeGold.setDistributionParams(_params);

        ITempleGold.DistributionParams memory _p = templeGold.getDistributionParameters();
        assertEq(_p.gnosis, _params.gnosis);
        assertEq(_p.escrow, _params.escrow);
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
        _templeGold.setVestingFactor(_getVestingFactor());
        _templeGold.setDistributionParams(_getDistributionParameters());
        skip(1 days);
        // invalid receiver. staking and escrow not set
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        _templeGold.mint();
    }

    function test_mint_tgld() public {
        vm.selectFork(arbitrumOneForkId);
        uint256 totalSupply = templeGold.totalSupply();
        _setVestingFactor(templeGold);
        skip(1 days);
        uint256 mintAmount = templeGold.getMintAmount();
        ITempleGold.DistributionParams memory _params = templeGold.getDistributionParameters();
        uint256 stakingAmount = _params.staking * mintAmount / 100 ether;
        uint256 gnosisAmount = _params.gnosis * mintAmount / 100 ether;
        uint256 escrowAmount = _params.escrow * mintAmount / 100 ether;
        vm.expectEmit(address(templeGold));
        emit Transfer(address(0), address(staking), stakingAmount);
        vm.expectEmit(address(templeGold));
        emit Transfer(address(0), address(daiGoldAuction), escrowAmount);
        vm.expectEmit(address(templeGold));
        emit Transfer(address(0), teamGnosis, gnosisAmount);
        vm.expectEmit(address(templeGold));
        emit Distributed(stakingAmount, escrowAmount, gnosisAmount, block.timestamp);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), escrowAmount);
        assertEq(templeGold.balanceOf(teamGnosis), gnosisAmount);
        // end of vesting
        totalSupply = templeGold.totalSupply();
        skip(99 days);
        mintAmount = templeGold.getMintAmount();
        stakingAmount += _params.staking * mintAmount / 100 ether;
        gnosisAmount += _params.gnosis * mintAmount / 100 ether;
        escrowAmount += _params.escrow * mintAmount / 100 ether;
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), escrowAmount);
        assertEq(templeGold.balanceOf(teamGnosis), gnosisAmount);
        // test mint amount = 0
        assertEq(templeGold.getMintAmount(), 0);
        // test coverage mintAmount = 0
        templeGold.mint();
    }

    function test_mint_tgld_distribution() public {
        vm.selectFork(arbitrumOneForkId);
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor;
        _factor.numerator = 1 days;
        _factor.denominator = 90 days;
        templeGold.setVestingFactor(_factor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        _params.gnosis = 0;
        _params.staking = 30 ether;
        _params.escrow = 70 ether;
        skip(30 days);
        uint256 totalSupply = templeGold.totalSupply();
        uint256 mintAmount = templeGold.getMintAmount();
        templeGold.setDistributionParams(_params);
        uint256 stakingAmount = _params.staking * mintAmount / 100 ether;
        uint256 gnosisAmount = 0;
        uint256 escrowAmount = _params.escrow * mintAmount / 100 ether;
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), escrowAmount);
        assertApproxEqAbs(templeGold.balanceOf(teamGnosis), gnosisAmount, 1);

        // staking = 0
        _params.gnosis = 10 ether;
        _params.staking = 0;
        _params.escrow = 90 ether;
        templeGold.setDistributionParams(_params);
        skip(30 days);
        mintAmount = templeGold.getMintAmount();
        totalSupply = templeGold.totalSupply();
        stakingAmount = 0;
        gnosisAmount = _params.gnosis * mintAmount / 100 ether;
        escrowAmount = _params.escrow * mintAmount / 100 ether;
        uint256 stakingBalance = templeGold.balanceOf(address(staking));
        uint256 daiGoldBalance = templeGold.balanceOf(address(daiGoldAuction));
        uint256 gnosisBalance = templeGold.balanceOf(teamGnosis);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingBalance+stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldBalance+escrowAmount);
        assertApproxEqAbs(templeGold.balanceOf(teamGnosis), gnosisBalance+gnosisAmount, 1);

        // dai gold auction = 0
        _params.gnosis = 10 ether;
        _params.staking = 90 ether;
        _params.escrow = 0;
        templeGold.setDistributionParams(_params);
        skip(30 days);
        mintAmount = templeGold.getMintAmount();
        totalSupply = templeGold.totalSupply();
        stakingAmount = _params.staking * mintAmount / 100 ether;
        gnosisAmount = _params.gnosis * mintAmount / 100 ether;
        escrowAmount = 0;
        stakingBalance = templeGold.balanceOf(address(staking));
        daiGoldBalance = templeGold.balanceOf(address(daiGoldAuction));
        gnosisBalance = templeGold.balanceOf(teamGnosis);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), totalSupply+mintAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingBalance+stakingAmount);
        assertEq(templeGold.balanceOf(address(daiGoldAuction)), daiGoldBalance+escrowAmount);
        assertApproxEqAbs(templeGold.balanceOf(teamGnosis), gnosisBalance+gnosisAmount, 1);
    }

    function test_mint_according_to_vesting_factor() public {
        vm.selectFork(arbitrumOneForkId);
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor;
        _factor.numerator = 1 seconds;
        _factor.denominator = 100 days;
        templeGold.setVestingFactor(_factor);
        skip(10 days);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), templeGold.MAX_SUPPLY() / 10);
        skip(10 days);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), templeGold.MAX_SUPPLY() / 5);
        skip(30 days);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), templeGold.MAX_SUPPLY() / 2);
        // 100 days vesting reached
        skip(50 days);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), templeGold.MAX_SUPPLY());
        // nothing minted
        assertEq(templeGold.getMintAmount(), 0);
        skip(1 days);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), templeGold.MAX_SUPPLY());
    }

    function test_mint_max_supply_tgld() public {
        templeGold.mint();
        // set vesting factor high to speed max supply mint time
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.numerator = 99 ether;
        templeGold.setVestingFactor(_factor);
        vm.warp(block.timestamp + 10 days);
        uint256 _expectedAmount = templeGold.getMintAmount();
        _expectedAmount = templeGold.MAX_SUPPLY() - templeGold.totalSupply();

        ITempleGold.DistributionParams memory _params = templeGold.getDistributionParameters();
        uint256 stakingAmount = _params.staking * _expectedAmount / 100 ether;
        uint256 gnosisAmount = _params.gnosis * _expectedAmount / 100 ether;
        uint256 escrowAmount = _params.escrow * _expectedAmount / 100 ether;
        vm.expectEmit(address(templeGold));
        emit Distributed(stakingAmount, escrowAmount, gnosisAmount, block.timestamp); 
        templeGold.mint();

        uint256 _totalSupply = templeGold.totalSupply();
        assertEq(_totalSupply, templeGold.MAX_SUPPLY());
        assertEq(templeGold.canDistribute(), false);
        // nothing is minted
        templeGold.mint();
        assertEq(templeGold.totalSupply(), _totalSupply);
        templeGold.mint();
        assertEq(templeGold.totalSupply(), _totalSupply);
        assertEq(templeGold.getMintAmount(), 0);
    }
}