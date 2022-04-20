pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../TempleTreasury.sol";
import "./interfaces/ICToken.sol";
import "./interfaces/ICErc20.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IBasePriceOracle.sol";


/**
 * @title TemplePriceOracle
 * @notice Returns on-chain IV price for temple
 * @dev Implements `PriceOracle` and `BasePriceOracle`.
 */
contract TemplePriceOracle is IPriceOracle, IBasePriceOracle {

    /**
     * @notice Temple treasury address.
     */
    TempleTreasury public TREASURY = TempleTreasury(0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443);

    /**
     * @notice Temple token address.
     */
    address public TEMPLE = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;

    /**
     * @dev The token on which to base IV (its price must be available via `msg.sender`).
     */
    address immutable public baseToken;

    constructor (address _baseToken) {
        baseToken = _baseToken;
    }

    /**
     * @notice Fetches the token/ETH price, with 18 decimals of precision.
     * @param underlying The underlying token address for which to get the price.
     * @return Price denominated in ETH (scaled by 1e18)
     */
    function price(address underlying) external override view returns (uint) {
        return _price(underlying);
    }

    /**
     * @notice Returns the price in ETH of the token underlying `cToken`.
     * @dev Implements the `PriceOracle` interface for Fuse pools (and Compound v2).
     * @return Price in ETH of the token underlying `cToken`, scaled by `10 ** (36 - underlyingDecimals)`.
     */
    function getUnderlyingPrice(ICToken cToken) external override view returns (uint) {
        address underlying = ICErc20(address(cToken)).underlying();
        // Comptroller needs prices to be scaled by 1e(36 - decimals)
        // Since `_price` returns prices scaled by 18 decimals, we must scale them by 1e(36 - 18 - decimals)
        return _price(underlying) * 1e18  / 10 ** uint256(ERC20(underlying).decimals());
    }

    /**
     * @notice Fetches the token/ETH price, with 18 decimals of precision.
     */
    function _price(address token) internal view returns (uint) {
        require(token == address(TEMPLE), "Invalid token passed to TemplePriceOracle");
        (uint256 stablec, uint256 temple) = TREASURY.intrinsicValueRatio();
        return stablec * IBasePriceOracle(msg.sender).price(baseToken) / ( 10 ** uint256(ERC20(baseToken).decimals()) * temple);
    }

}
