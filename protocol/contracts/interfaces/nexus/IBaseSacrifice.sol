pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/IBaseSacrifice.sol)


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISacrifice {
    event TokenSacrificed(address account, uint256 amount);
    event PartnerSacrifice(address to, uint256 relicId, uint256 enclaveId);
    event OriginTimeSet(uint64 originTime);

    error FutureOriginTime(uint64 originTime);
   
    /*
     * @notice Get amount of tokens to mint a Relic
     * @return Relic price
     */
    function getPrice() external view returns (uint256);

    /*
     * @notice Set origin time.
     * Origin time is the start of the linear ascending price to params.priceMaxPeriod
     * @param _originTime Origin time
     */
    function setOriginTime(uint64 _originTime) external;
}

interface IPartnerSacrifice is ISacrifice {
    /*
     * @notice Sacrifice tokens to mint a Relic
     * Caller must approve contract to spend tokens. Special case for partner Relic mint
     * @param enclaveId Enclave ID 
     * @param to Destination address
     */
    function sacrifice(uint256 enclaveId, address to) external;
}

interface IBaseSacrifice is ISacrifice {

    event CustomPriceSet(uint256 price);
    event PriceParamsSet(PriceParam params);
    event TokenRecipientSet(address recipient);

    struct PriceParam {
        uint64 priceMaxPeriod;
        uint128 minimumPrice;
        uint128 maximumPrice;
    }

    /*
     * @notice Set price parameters.
     * @param _priceParams Price parameters to set
     */
    function setPriceParams(PriceParam calldata _priceParams) external;

    /*
     * @notice Set custom price
     * owner can reset price with 0 _price value. Custom price can be set anytime during or after params.priceMaxPeriod on
     * a flash sale or at a discounted price.
     * @param _price Custom price 
     */
    function setCustomPrice(uint256 _price) external;

    /*
     * @notice Sacrifice tokens to mint a Relic
     * Caller must approve contract to spend tokens
     * @param enclaveId Enclave ID 
     */
    function sacrifice(uint256 enclaveId) external;

    /*
     * @notice Sacrifice Token address
     * @return Sacrifice Token address
     */
    function sacrificeToken() external view returns (IERC20);
}