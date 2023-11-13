pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/ITempleSacrifice.sol)


// interface ITempleSacrificeOld {

//     event OriginTimeSet(uint64 originTime);
//     event CustomPriceSet(uint256 price);
//     event TokenSacrificed(address account, uint256 amount);
//     event PriceParamsSet(PriceParam params);
//     event TokenRecipientSet(address recipient);

//     error FutureOriginTime(uint64 originTime);

//     struct PriceParam {
//         uint64 priceMaxPeriod;
//         uint128 minimumPrice;
//         uint128 maximumPrice;
//     }

//     /*
//      * @notice Set sacrificed temple recipient.
//      * @param recipient Recipient
//      */
//     function setSacrificedTokenRecipient(address recipient) external;

//     /*
//      * @notice Set price parameters.
//      * @param _priceParams Price parameters to set
//      */
//     function setPriceParams(PriceParam calldata _priceParams) external;

//     /*
//      * @notice Set origin time.
//      * Origin time is the start of the linear ascending price to params.priceMaxPeriod
//      * @param _originTime Origin time
//      */
//     function setOriginTime(uint64 _originTime) external;

//     /*
//      * @notice Set custom price
//      * owner can reset price with 0 _price value. Custom price can be set anytime during or after params.priceMaxPeriod on
//      * a flash sale or at a discounted price.
//      * @param _price Custom price 
//      */
//     function setCustomPrice(uint256 _price) external;

//     /*
//      * @notice Sacrifice TEMPLE tokens to mint a Relic
//      * Caller must approve contract to spend TEMPLE tokens
//      * @param enclaveId Enclave ID 
//      */
//     function sacrifice(uint256 enclaveId) external;
   
//     /*
//      * @notice Get amount of TEMPLE tokens to mint a Relic
//      * @return Relic price
//      */
//     function getPrice() external view returns (uint256);
// }