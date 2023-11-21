pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/IBaseSacrifice.sol)


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISacrifice {
    event TokenSacrificed(address indexed fromAccount, address indexed token, uint256 amount);
    event PartnerZeroSacrificed(address indexed to, uint256 relicId, uint256 enclaveId);
    event OriginTimeSet(uint64 originTime);
    event RelicMintCapSet(uint256 cap);

    error FutureOriginTime(uint64 originTime);
    error MintCapExceeded(uint256 newTotal);
   
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

    /*
     * @notice Sacrifice tokens to mint a Relic
     * Caller must approve contract to spend tokens.
     * @param enclaveId Enclave ID 
     * @param to Destination address
     */
    function sacrifice(uint256 enclaveId, address to) external returns (uint256 relicId);
}

interface IPartnerSacrifice is ISacrifice {
    /*
     * @notice Get mint cap for partner
     * @return Mint Cap
     */
    function mintCap() external view returns (uint256);
    
    /*
     * @notice Get total Relics minted by partner
     * @return Total minted Relics
     */
    function totalMinted() external view returns (uint256);

    /*
     * @notice set mint cap for partner
     * @param cap Cap to set
     */
    function setMintCap(uint256 cap) external;
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
     * @notice Sacrifice Token address
     * @return Sacrifice Token address
     */
    function sacrificeToken() external view returns (IERC20);
}