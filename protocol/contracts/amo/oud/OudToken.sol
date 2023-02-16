pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Oud (protocol/contracts/amo/oud/Oud.sol)

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20, ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AMO__IOudToken} from "../interfaces/AMO__IOudtoken.sol";

/// @notice An ERC20 token which can be minted/burnt by approved accounts
contract OudToken is AMO__IOudToken, ERC20Permit, Ownable {
    using SafeERC20 for IERC20;

    /// @notice A set of addresses which are approved to mint/burn
    mapping(address => bool) internal _minters;

    event AddedMinter(address indexed account);
    event RemovedMinter(address indexed account);
    event TokenRecovered(address token, address to, uint256 amount);

    function isMinter(address account) external view returns (bool) {
        return _minters[account];
    }

    error CannotMintOrBurn(address caller);

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol) 
        ERC20Permit(_name) 
    {
    }

    function mint(address _to, uint256 _amount) external override {
        if (!_minters[msg.sender]) revert CannotMintOrBurn(msg.sender);
        _mint(_to, _amount);
    }

    function burn(address account, uint256 amount) external override {
        if (!_minters[msg.sender]) revert CannotMintOrBurn(msg.sender);
        _burn(account, amount);
    }

    function addMinter(address account) external onlyOwner {
        _minters[account] = true;
        emit AddedMinter(account);
    }

    function removeMinter(address account) external onlyOwner {
        _minters[account] = false;
        emit RemovedMinter(account);
    }

    /// @notice Owner can recover tokens
    function recoverToken(address _token, address _to, uint256 _amount) external onlyOwner {
        emit TokenRecovered(_token, _to,  _amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }

}