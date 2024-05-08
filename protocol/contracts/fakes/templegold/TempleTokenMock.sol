pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract TempleTokenMock is ERC20, ERC20Burnable, Ownable, AccessControl {
    bytes32 public constant CAN_MINT = keccak256("CAN_MINT");

    constructor() ERC20("Temple", "TEMPLE") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
    }

    function mint(address to, uint256 amount) external {
      require(hasRole(CAN_MINT, msg.sender), "Caller cannot mint");
      _mint(to, amount);
    }

    function addMinter(address account) external onlyOwner {
        grantRole(CAN_MINT, account);
    }

    function removeMinter(address account) external onlyOwner {
        revokeRole(CAN_MINT, account);
    }
}