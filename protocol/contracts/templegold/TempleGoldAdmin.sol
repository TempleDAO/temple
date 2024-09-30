pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldProxy.sol)


import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ITempleGoldAdmin, IOFTCore } from "contracts/interfaces/templegold/ITempleGoldAdmin.sol";
import { IOAppOptionsType3, EnforcedOptionParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";
import { IOAppCore } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppCore.sol";
import { IOAppPreCrimeSimulator } from "@layerzerolabs/lz-evm-oapp-v2/contracts/precrime/interfaces/IOAppPreCrimeSimulator.sol";


/**
 * @title Temple Gold Admin
 * @notice Temple Gold Admin is an admin to Temple Gold contract. 
 * From the setup of layerzero, `Ownable` is used for admin executions. 
 * Avoids a manual import to change `Ownable` to `ElevatedAccess` by using this contract for admin executions
 */
contract TempleGoldAdmin is ITempleGoldAdmin, TempleElevatedAccess {
    /// @notice Temple Gold
    ITempleGold public immutable override templeGold;
    
    constructor(
        address _rescuer,
        address _executor,
        address _templeGold
    ) TempleElevatedAccess(_rescuer, _executor) {
        templeGold = ITempleGold(_templeGold);
    }

    /**
     * @notice Set staking proxy contract address
     * @param _staking Staking proxy contract
     */
    function setStaking(address _staking) external override onlyElevatedAccess {
        templeGold.setStaking(_staking);
    }

    /**
     * @notice Set auctions Dai Gold contract address
     * @param _daiGoldAuction  contract address
     */
    function setDaiGoldAuction(address _daiGoldAuction) external override onlyElevatedAccess {
        templeGold.setDaiGoldAuction(_daiGoldAuction);
    }

    /**
     * @notice Set team gnosis address
     * @param _gnosis Team gnosis address
     */
    function setTeamGnosis(address _gnosis) external override onlyElevatedAccess {
        templeGold.setTeamGnosis(_gnosis);
    }

    /**
     * @notice Whitelist an address to allow transfer of Temple Gold to or from
     * @param _contract Contract address to whitelist
     * @param _whitelist Boolean whitelist state
     */
    function authorizeContract(address _contract, bool _whitelist) external override onlyElevatedAccess {
        templeGold.authorizeContract(_contract, _whitelist);
    } 

    /**
     * @notice Set distribution percentages of newly minted Temple Gold
     * @param _params Distribution parameters
     */
    function setDistributionParams(ITempleGold.DistributionParams memory _params) external override onlyElevatedAccess {
       templeGold.setDistributionParams(_params);
    }

    /**
     * @notice Set vesting factor
     * @param _factor Vesting factor
     */
    function setVestingFactor(ITempleGold.VestingFactor memory _factor) external override onlyElevatedAccess {
        templeGold.setVestingFactor(_factor);
    }

    /**
     * @dev Sets the message inspector address for the OFT.
     * @param _msgInspector The address of the message inspector.
     *
     * @dev This is an optional contract that can be used to inspect both 'message' and 'options'.
     * @dev Set it to address(0) to disable it, or set it to a contract address to enable it.
     */
    function setMsgInspector(address _msgInspector) external virtual onlyElevatedAccess {
        IOFTCore(address(templeGold)).setMsgInspector(_msgInspector);
    }

    /**
     * @dev Sets the preCrime contract address.
     * @param _preCrime The address of the preCrime contract.
     */
    function setPreCrime(address _preCrime) public virtual onlyElevatedAccess {
        IOAppPreCrimeSimulator(address(templeGold)).setPreCrime(_preCrime);
    }

     /**
     * @notice Sets the delegate address for the OApp.
     * @param _delegate The address of the delegate to be set.
     *
     * @dev Only elevated access of the OApp can call this function.
     * @dev Provides the ability for a delegate to set configs, on behalf of the OApp, directly on the Endpoint contract.
     */
    function setDelegate(address _delegate) public onlyElevatedAccess {
        IOAppCore(address(templeGold)).setDelegate(_delegate);
    }

    /**
     * @notice Sets the peer address (OApp instance) for a corresponding endpoint.
     * @param _eid The endpoint ID.
     * @param _peer The address of the peer to be associated with the corresponding endpoint.
     *
     * @dev Only the owner/admin of the OApp can call this function.
     * @dev Indicates that the peer is trusted to send LayerZero messages to this OApp.
     * @dev Set this to bytes32(0) to remove the peer address.
     * @dev Peer is a bytes32 to accommodate non-evm chains.
     */
    function setPeer(uint32 _eid, bytes32 _peer) public virtual onlyElevatedAccess {
        IOAppCore(address(templeGold)).setPeer(_eid, _peer);
    }

    /**
     * @dev Sets the enforced options for specific endpoint and message type combinations.
     * @param _enforcedOptions An array of EnforcedOptionParam structures specifying enforced options.
     *
     * @dev Only the owner/admin of the OApp can call this function.
     * @dev Provides a way for the OApp to enforce things like paying for PreCrime, AND/OR minimum dst lzReceive gas amounts etc.
     * @dev These enforced options can vary as the potential options/execution on the remote may differ as per the msgType.
     * eg. Amount of lzReceive() gas necessary to deliver a lzCompose() message adds overhead you dont want to pay
     * if you are only making a standard LayerZero message ie. lzReceive() WITHOUT sendCompose().
     */
    function setEnforcedOptions(EnforcedOptionParam[] calldata _enforcedOptions) public virtual onlyElevatedAccess {
        IOAppOptionsType3(address(templeGold)).setEnforcedOptions(_enforcedOptions);
    }
}