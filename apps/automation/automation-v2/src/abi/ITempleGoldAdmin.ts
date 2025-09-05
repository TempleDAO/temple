export const ABI = [
  {
    "type": "function",
    "name": "authorizeContract",
    "inputs": [
      {
        "name": "_contract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_whitelist",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDelegate",
    "inputs": [
      {
        "name": "_delegate",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDistributionParams",
    "inputs": [
      {
        "name": "_params",
        "type": "tuple",
        "internalType": "struct ITempleGold.DistributionParams",
        "components": [
          {
            "name": "staking",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "auction",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "gnosis",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setEnforcedOptions",
    "inputs": [
      {
        "name": "_enforcedOptions",
        "type": "tuple[]",
        "internalType": "struct EnforcedOptionParam[]",
        "components": [
          {
            "name": "eid",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "msgType",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "options",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPeer",
    "inputs": [
      {
        "name": "_eid",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "_peer",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPreCrime",
    "inputs": [
      {
        "name": "_preCrime",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setStableGoldAuction",
    "inputs": [
      {
        "name": "_auction",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setStaking",
    "inputs": [
      {
        "name": "_staking",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTeamGnosis",
    "inputs": [
      {
        "name": "_gnosis",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setVestingFactor",
    "inputs": [
      {
        "name": "_factor",
        "type": "tuple",
        "internalType": "struct ITempleGold.VestingFactor",
        "components": [
          {
            "name": "value",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "weekMultiplier",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "templeGold",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITempleGold"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "_newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;
