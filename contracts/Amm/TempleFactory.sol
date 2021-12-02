pragma solidity ^0.5.16;

import './interfaces/ITempleFactory.sol';
import './UniswapV2Pair.sol';

contract TempleFactory is IUniswapV2Factory {
    address public feeTo;
    address public feeToSetter;
    address public owner;

    address public templeToken;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _feeToSetter, address _owner, address _templeToken) public {
        feeToSetter = _feeToSetter;
        owner = _owner;
        templeToken = _templeToken;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function getContractCreationByteCode(address _owner) public pure returns (bytes memory) {
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        return abi.encodePacked(bytecode, abi.encode(_owner));
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'TempleFactory: IDENTICAL_ADDRESSES');
        require(tokenA == templeToken || tokenB == templeToken, 'TempleFactory: Invalid Pair');
        require(msg.sender == owner, 'TempleFactory: FORBIDDEN');
        (address token0, address token1) = tokenA == templeToken ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'TempleFactory: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'TempleFactory: PAIR_EXISTS'); // single check is sufficient

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
        require(msg.sender == feeToSetter, 'TempleFactory: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, 'TempleFactory: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, 'TempleFactory: FORBIDDEN');
        owner = _owner;
    }
}