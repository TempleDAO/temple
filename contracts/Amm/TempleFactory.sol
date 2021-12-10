pragma solidity ^0.5.16;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/UniswapV2Pair.sol';

contract TempleFactory is IUniswapV2Factory {
    address public feeTo;

    // change from default factory. Only owner can create new pairs and set fees
    address public owner; 

    // change from default factory. Pairs must be with temple
    address public templeToken;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    // Update from default factory. Add owner and templeToken to constructor, remove feeToSetter
    constructor(address _owner, address _templeToken) public {
        owner = _owner;
        templeToken = _templeToken;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    // change from default. Add owner to create call for Pair contract
    function getContractCreationByteCode(address _owner) public pure returns (bytes memory) {
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        return abi.encodePacked(bytecode, abi.encode(_owner));
    }
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        // New checks
        require(msg.sender == owner, 'TempleFactory: FORBIDDEN');
        require(tokenA == templeToken || tokenB == templeToken, 'TempleFactory: Invalid Pair');

        // Standard checks from forked contract
        require(tokenA != tokenB, 'TempleAMMFactory: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'TempleAMMFactory: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'TempleAMMFactory: PAIR_EXISTS'); // single check is sufficient
        
        // Update bytecode for contract creation to include owner
        bytes memory bytecode = getContractCreationByteCode(owner);

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IUniswapV2Pair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == owner, 'TempleFactory: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, 'TempleFactory: FORBIDDEN');
        owner = _owner;
    }
}
