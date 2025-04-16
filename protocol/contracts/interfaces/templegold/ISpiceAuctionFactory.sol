pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuctionFactory.sol)

interface ISpiceAuctionFactory {
    event AuctionCreated(address indexed spiceToken, uint256 version, address auction);
    event SpiceAuctionImplementationSet(address implementation);
    event StrategyGnosisSet(address gnosis);
    event OperatorSet(address operator);
    event DaoExecutorSet(address executor);

    /// @notice Temple Gold
    function templeGold() external view returns (address);

    /// @notice Dao executing contract
    function daoExecutor() external view returns (address);

    /// @notice Operator
    function operator() external view returns (address);

    /// @notice Strategy Gnosis address which funds spice auctions
    function strategyGnosis() external view returns (address);

    /**
     * @notice Create Spice Auction contract
     * @param spiceToken Spice token
     * @param name Name of spice auction contract
     * @return Address of newly created spice auction
     */
    function createAuction(address spiceToken, string memory name) external returns (address);

    /**
     * @notice Given a spice token, retrieve the spice auction contract
     * @param spiceToken Spice token
     * @return Address of spice auction contract
     */
    function findAuctionForSpiceToken(address spiceToken) external view returns (address);

    /// @notice Spice auction implementation
    function implementation() external view returns (address);

    /**
     * @notice Set strategy gnosis address
     * @param _gnosis Strategy gnosis address
     */
    function setStrategyGnosis(address _gnosis) external;

    /**
     * @notice Set operator
     * @param _operator Operator address
     */
    function setOperator(address _operator) external;

    /**
     * @notice Set DAO executor address
     * @param _executor Executor address
     */
    function setDaoExecutor(address _executor) external;

    /**
     * @notice Set spice auction implementation address
     * @param _implementation Implementation address
     */
    function setImplementation(address _implementation) external;

    /**
     * @notice Keep track of last version of spice auction deployed for a spice token
     * @param spiceToken Spice token address
     */
    function spiceTokenLatestVersion(address spiceToken) external view returns (uint256 latestVersion);

    /**
     * @notice Keep track of deployed spice auctions
     * @param spiceToken Spice token address
     * @param version Version of deployed spice token
     */
    function deployedAuctions(address spiceToken, uint256 version) external view returns (address auction);

    /**
     * @notice Keep track of deployed spice auctions
     * @param spiceToken Spice token address
     * @return version Version of last deployed spice auction
     */
    function getLastAuctionVersion(address spiceToken) external view returns (uint256 version);
}