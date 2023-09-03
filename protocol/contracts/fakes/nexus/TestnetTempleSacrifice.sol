pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/TestnetTempleSacrifice.sol)

import { IRelic } from "../../interfaces/nexus/IRelic.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";
import { CommonEventsAndErrors } from "../../common/CommonEventsAndErrors.sol";

/// @dev for testnet only
contract TestnetTempleSacrifice {

    ///@notice the Relic ERC721A token
    IRelic public immutable relic;
    /// @notice the temple token used for payment in minting a relic
    ITempleERC20Token public immutable templeToken;

    event TempleSacrificed(address account, uint256 amount);

    constructor(address _relic, address _templeToken) {
        relic = IRelic(_relic);
        templeToken = ITempleERC20Token(_templeToken);
    }

    // modified so that anyone can mint
    function sacrifice(address account, IRelic.Enclave enclave) external {
        uint256 amount = getPrice();
        templeToken.burnFrom(account, amount);
        relic.mintRelic(account, enclave);
        emit TempleSacrificed(account, amount);
    }

    function getPrice() public pure returns (uint256) {
        return 1**18;
    }
}