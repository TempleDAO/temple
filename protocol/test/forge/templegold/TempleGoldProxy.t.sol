pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldProxy.t.sol)


import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { StakedTempleVoteToken } from "contracts/templegold/StakedTempleVoteToken.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { TempleGoldProxy } from "contracts/templegold/TempleGoldProxy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { EnforcedOptionParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";

contract TempleGoldProxyTestBase is TempleGoldCommon {
    event ContractAuthorizationSet(address indexed _contract, bool _whitelisted);
    event VestingFactorSet(uint128 numerator, uint128 denominator);
    event DistributionParamsSet(uint256 staking, uint256 escrow, uint256 gnosis);
    event StakingSet(address staking);
    event EscrowSet(address escrow);
    event TeamGnosisSet(address gnosis);

    DaiGoldAuction public daiGoldAuction;
    TempleGoldStaking public staking;
    TempleGold public templeGold;
    TempleGold public templeGoldMainnet;
    FakeERC20 public templeToken;
    StakedTempleVoteToken public voteToken;
    TempleGoldProxy public templeGoldProxy;

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
        voteToken = new StakedTempleVoteToken(rescuer, executor,address(0), VOTE_TOKEN_NAME, VOTE_TOKEN_SYMBOL);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold), address(voteToken));
        daiGoldAuction = new DaiGoldAuction(
            address(templeGold),
            daiToken,
            treasury,
            rescuer,
            executor
        );
        templeGoldProxy = new TempleGoldProxy(rescuer, executor, address(templeGold));
        vm.startPrank(executor);
        voteToken.setStaking(address(staking));
        voteToken.setAuthorized(address(staking), true);
        templeGold.setEscrow(address(daiGoldAuction)); 
        _configureTempleGold();
        templeGold.transferOwnership(address(templeGoldProxy));
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(templeGoldProxy.rescuer(), rescuer);
        assertEq(templeGoldProxy.executor(), executor);
        assertEq(address(templeGoldProxy.templeGold()), address(templeGold));
        assertEq(templeGold.owner(), address(templeGoldProxy));
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
        templeGold.setStaking(address(staking));
        // whitelist
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }
}

contract TempleGoldProxyAccessTest is TempleGoldProxyTestBase {
    function test_access_setStaking_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setStaking(alice);
    }

    function test_access_setEscrow_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setEscrow(alice);
    }

    function test_access_setTeamgnosis_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setTeamGnosis(alice);
    }

    function test_access_authorizeContract_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.authorizeContract(alice, true);
    }
    function test_access_setDistributionParams_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setDistributionParams(_getDistributionParameters());
    }

    function test_access_setVestingFactor_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setVestingFactor(_getVestingFactor());
    }
    
    function test_access_setMsgInspector_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setMsgInspector(alice);
    }

    function test_access_setPreCrime_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setPreCrime(alice);
    }

    function test_access_setDelegate_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setDelegate(alice);
    }

    function test_access_setPeer_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeGoldProxy.setPeer(MAINNET_LZ_EID, bytes32(uint256(uint160(alice))));
    }

    function test_access_setEnforcedOptions_tgldProxy() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        EnforcedOptionParam[] memory _params;
        templeGoldProxy.setEnforcedOptions(_params);
    }
}

contract TempleGoldProxyTest is TempleGoldProxyTestBase {
    function test_setStaking_tgoldProxy() public {
        vm.startPrank(executor);

        vm.expectEmit(address(templeGold));
        emit StakingSet(address(staking));
        templeGoldProxy.setStaking(address(staking));
        assertEq(address(templeGold.staking()), address(staking));
        vm.expectEmit(address(templeGold));
        emit StakingSet(alice);
        templeGoldProxy.setStaking(alice);
        assertEq(address(templeGold.staking()), alice);
    }

    function test_setEscrow_tgoldProxy() public {
        vm.startPrank(executor);

        vm.expectEmit(address(templeGold));
        emit EscrowSet(address(daiGoldAuction));
        templeGoldProxy.setEscrow(address(daiGoldAuction));
        assertEq(address(templeGold.escrow()), address(daiGoldAuction));
        vm.expectEmit(address(templeGold));
        emit EscrowSet(alice);
        templeGoldProxy.setEscrow(alice);
        assertEq(address(templeGold.escrow()), alice);
    }

    function test_setTeamGnosis_tgldProxy() public {
        vm.startPrank(executor);

        vm.expectEmit(address(templeGold));
        emit TeamGnosisSet(teamGnosis);
        templeGoldProxy.setTeamGnosis(teamGnosis);
        assertEq(templeGold.teamGnosis(), teamGnosis);
        vm.expectEmit(address(templeGold));
        emit TeamGnosisSet(alice);
        templeGoldProxy.setTeamGnosis(alice);
        assertEq(templeGold.teamGnosis(), alice);
    }

     function test_authorizeContract_tgldProxy() public {
        vm.startPrank(executor);

        address escrow = address(daiGoldAuction);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(escrow, true);
        templeGoldProxy.authorizeContract(escrow, true);
        assertEq(templeGold.authorized(escrow), true);
        vm.expectEmit(address(templeGold));
        emit ContractAuthorizationSet(escrow, false);
        templeGoldProxy.authorizeContract(escrow, false);
        assertEq(templeGold.authorized(escrow), false);
    }

    function test_setVestingFactor_tgldProxy() public {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        vm.expectEmit(address(templeGold));
        emit VestingFactorSet(_factor.numerator, _factor.denominator);
        templeGoldProxy.setVestingFactor(_factor);
        ITempleGold.VestingFactor memory _vf = templeGold.getVestingFactor();
        assertEq(_vf.numerator, 10 ether);
        assertEq(_vf.denominator, 100 ether);
    }

    function test_setDistributionParameters_tgldProxy() public {
        vm.startPrank(executor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        vm.expectEmit(address(templeGold));
        emit DistributionParamsSet(_params.staking, _params.escrow, _params.gnosis);
        templeGoldProxy.setDistributionParams(_params);

        ITempleGold.DistributionParams memory _p = templeGold.getDistributionParameters();
        assertEq(_p.gnosis, _params.gnosis);
        assertEq(_p.escrow, _params.escrow);
        assertEq(_p.staking, _params.staking);
    }

   

}
