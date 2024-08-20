pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldAdmin.t.sol)


import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { TempleGoldAdmin } from "contracts/templegold/TempleGoldAdmin.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { EnforcedOptionParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";
import { IOAppOptionsType3 } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";

contract TempleGoldAdminTestBase is TempleGoldCommon {
    event ContractAuthorizationSet(address indexed _contract, bool _whitelisted);
    event VestingFactorSet(uint128 value, uint128 weekMultiplier);
    event DistributionParamsSet(uint256 staking, uint256 daiGoldAuction, uint256 gnosis);
    event StakingSet(address staking);
    event DaiGoldAuctionSet(address daiGoldAuction);
    event TeamGnosisSet(address gnosis);

    DaiGoldAuction public daiGoldAuction;
    TempleGoldStaking public staking;
    TempleGold public templeGold;
    TempleGold public templeGoldMainnet;
    FakeERC20 public templeToken;
    TempleGoldAdmin public templeGoldAdmin;

    uint256 public constant MINIMUM_DISTRIBUTION_SHARE = 1 ether;
    uint256 public constant ARBITRUM_ONE_BLOCKNUMBER_B = 207201713;
    uint256 public constant MINIMUM_MINT = 1_000;
    uint256 public arbitrumOneForkId;
    uint256 public mainnetForkId;

    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);
        arbitrumOneForkId = forkId;

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
        templeGoldAdmin = new TempleGoldAdmin(rescuer, executor, address(templeGold));
        vm.startPrank(executor);
        _configureTempleGold();
        templeGold.transferOwnership(address(templeGoldAdmin));
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(templeGoldAdmin.rescuer(), rescuer);
        assertEq(templeGoldAdmin.executor(), executor);
        assertEq(address(templeGoldAdmin.templeGold()), address(templeGold));
        assertEq(templeGold.owner(), address(templeGoldAdmin));
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
        templeGold.setStaking(address(staking));
        templeGold.setTeamGnosis(address(teamGnosis));
        // whitelist
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }
}

contract TempleGoldAdminAccessTest is TempleGoldAdminTestBase {
    function test_access_setStaking_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setStaking(alice);
    }

    function test_access_setdaiGoldAuction_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setDaiGoldAuction(alice);
    }

    function test_access_setTeamgnosis_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setTeamGnosis(alice);
    }

    function test_access_authorizeContract_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.authorizeContract(alice, true);
    }
    function test_access_setDistributionParams_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setDistributionParams(_getDistributionParameters());
    }

    function test_access_setVestingFactor_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setVestingFactor(_getVestingFactor());
    }
    
    function test_access_setMsgInspector_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setMsgInspector(alice);
    }

    function test_access_setPreCrime_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setPreCrime(alice);
    }

    function test_access_setDelegate_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setDelegate(alice);
    }

    function test_access_setPeer_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldAdmin.setPeer(MAINNET_LZ_EID, bytes32(uint256(uint160(alice))));
    }

    function test_access_setEnforcedOptions_tgldAdmin() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        EnforcedOptionParam[] memory _params;
        templeGoldAdmin.setEnforcedOptions(_params);
    }
}

contract TempleGoldAdminTest is TempleGoldAdminTestBase {
    function test_setStaking_tgoldProxy() public {
        vm.startPrank(executor);

        vm.expectEmit(address(templeGold));
        emit StakingSet(address(staking));
        templeGoldAdmin.setStaking(address(staking));
        assertEq(address(templeGold.staking()), address(staking));
        vm.expectEmit(address(templeGold));
        emit StakingSet(alice);
        templeGoldAdmin.setStaking(alice);
        assertEq(address(templeGold.staking()), alice);
    }

    function test_setdaiGoldAuction_tgoldProxy() public {
        vm.startPrank(executor);

        vm.expectEmit(address(templeGold));
        emit DaiGoldAuctionSet(address(daiGoldAuction));
        templeGoldAdmin.setDaiGoldAuction(address(daiGoldAuction));
        assertEq(address(templeGold.daiGoldAuction()), address(daiGoldAuction));
        vm.expectEmit(address(templeGold));
        emit DaiGoldAuctionSet(alice);
        templeGoldAdmin.setDaiGoldAuction(alice);
        assertEq(address(templeGold.daiGoldAuction()), alice);
    }

    function test_setTeamGnosis_tgldAdmin() public {
        vm.startPrank(executor);

        vm.expectEmit(address(templeGold));
        emit TeamGnosisSet(teamGnosis);
        templeGoldAdmin.setTeamGnosis(teamGnosis);
        assertEq(templeGold.teamGnosis(), teamGnosis);
        vm.expectEmit(address(templeGold));
        emit TeamGnosisSet(alice);
        templeGoldAdmin.setTeamGnosis(alice);
        assertEq(templeGold.teamGnosis(), alice);
    }

     function test_authorizeContract_tgldAdmin() public {
        vm.startPrank(executor);

        address daiGoldAuction = address(daiGoldAuction);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(daiGoldAuction, true);
        templeGoldAdmin.authorizeContract(daiGoldAuction, true);
        assertEq(templeGold.authorized(daiGoldAuction), true);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(daiGoldAuction, false);
        templeGoldAdmin.authorizeContract(daiGoldAuction, false);
        assertEq(templeGold.authorized(daiGoldAuction), false);
    }

    function test_setVestingFactor_tgldAdmin() public {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        vm.expectEmit(address(templeGold));
        emit VestingFactorSet(_factor.value, _factor.weekMultiplier);
        templeGoldAdmin.setVestingFactor(_factor);
        ITempleGold.VestingFactor memory _vf = templeGold.getVestingFactor();
        assertEq(_vf.value, 10 ether);
        assertEq(_vf.weekMultiplier, 100 ether);
    }

    function test_setDistributionParameters_tgldAdmin() public {
        vm.startPrank(executor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        vm.expectEmit(address(templeGold));
        emit DistributionParamsSet(_params.staking, _params.daiGoldAuction, _params.gnosis);
        templeGoldAdmin.setDistributionParams(_params);

        ITempleGold.DistributionParams memory _p = templeGold.getDistributionParameters();
        assertEq(_p.gnosis, _params.gnosis);
        assertEq(_p.daiGoldAuction, _params.daiGoldAuction);
        assertEq(_p.staking, _params.staking);
    }

    function test_setMsgInspector_tgldAdmin() public {
        vm.startPrank(executor);
        templeGoldAdmin.setMsgInspector(alice);
        assertEq(templeGold.msgInspector(), alice);
        // msgInspector
    }

    function test_setPreCrime_tgldAdmin() public {
        vm.startPrank(executor);
        templeGoldAdmin.setPreCrime(alice);
        assertEq(templeGold.preCrime(), alice);
    }

    function test_setDelegate_tgldAdmin() public {
        vm.startPrank(executor);
        templeGoldAdmin.setDelegate(alice);
        // ILayerZeroEndpointV2 does not provide an interface for this variable getter
        (, bytes memory data) = layerZeroEndpointArbitrumOne.call{value: 0}(abi.encodeWithSignature("delegates(address)", address(templeGold)));
        address delegate = abi.decode(data, (address));
        assertEq(delegate, alice);
    }

    function test_setPeer_tgldAdmin() public {
        vm.startPrank(executor);
        bytes32 peerAsBytes32 = bytes32(uint256(uint160(alice)));
        templeGoldAdmin.setPeer(MAINNET_LZ_EID, peerAsBytes32);
        assertEq(templeGold.isPeer(MAINNET_LZ_EID, peerAsBytes32), true);
    }

    function test_setEnforcedOptions_tgldAdmin() public {
        vm.startPrank(executor);
        EnforcedOptionParam[] memory enforcedOptions = new EnforcedOptionParam[](1);
        enforcedOptions[0] = EnforcedOptionParam(MAINNET_LZ_EID, 1, hex"0004"); // not type 3
        vm.expectRevert(abi.encodeWithSelector(IOAppOptionsType3.InvalidOptions.selector, hex"0004"));
        templeGoldAdmin.setEnforcedOptions(enforcedOptions);

        enforcedOptions[0] = EnforcedOptionParam(MAINNET_LZ_EID, 1, hex"0003"); // type 3
        templeGoldAdmin.setEnforcedOptions(enforcedOptions);
        assertEq(templeGold.enforcedOptions(MAINNET_LZ_EID, 1), hex"0003");
    }
}
