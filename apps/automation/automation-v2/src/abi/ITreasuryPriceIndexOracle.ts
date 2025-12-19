export const ABI = [
  {
    "type": "function",
    "name": "TPI_DECIMALS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptExecutor",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "acceptRescuer",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executor",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "explicitFunctionAccess",
    "inputs": [
      {
        "name": "contractAddr",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "functionSelector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "inRescueMode",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "maxAbsTreasuryPriceIndexRateOfChange",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "maxTreasuryPriceIndexDelta",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minTreasuryPriceIndexTargetTimeDelta",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proposeNewExecutor",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposeNewRescuer",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rescuer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setExplicitAccess",
    "inputs": [
      {
        "name": "allowedCaller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "access",
        "type": "tuple[]",
        "internalType": "struct ITempleElevatedAccess.ExplicitAccess[]",
        "components": [
          {
            "name": "fnSelector",
            "type": "bytes4",
            "internalType": "bytes4"
          },
          {
            "name": "allowed",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMaxAbsTreasuryPriceIndexRateOfChange",
    "inputs": [
      {
        "name": "tpiDelta",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "timeDelta",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMaxTreasuryPriceIndexDelta",
    "inputs": [
      {
        "name": "maxDelta",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinTreasuryPriceIndexTargetTimeDelta",
    "inputs": [
      {
        "name": "maxTargetTimeDelta",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRescueMode",
    "inputs": [
      {
        "name": "value",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTreasuryPriceIndexAt",
    "inputs": [
      {
        "name": "targetTpi",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "targetTime",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "tpiData",
    "inputs": [],
    "outputs": [
      {
        "name": "startingTpi",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "startTime",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "targetTpi",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "targetTime",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "tpiSlope",
        "type": "int96",
        "internalType": "int96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "treasuryPriceIndex",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ExplicitAccessSet",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "fnSelector",
        "type": "bytes4",
        "indexed": true,
        "internalType": "bytes4"
      },
      {
        "name": "value",
        "type": "bool",
        "indexed": true,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MaxAbsTreasuryPriceIndexRateOfChangeSet",
    "inputs": [
      {
        "name": "maxAbsRateOfChange",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MaxTreasuryPriceIndexDeltaSet",
    "inputs": [
      {
        "name": "maxDelta",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MinTreasuryPriceIndexTargetTimeDeltaSet",
    "inputs": [
      {
        "name": "maxTargetTimeDelta",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NewExecutorAccepted",
    "inputs": [
      {
        "name": "oldExecutor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newExecutor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NewExecutorProposed",
    "inputs": [
      {
        "name": "oldExecutor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "oldProposedExecutor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newProposedExecutor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NewRescuerAccepted",
    "inputs": [
      {
        "name": "oldRescuer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newRescuer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NewRescuerProposed",
    "inputs": [
      {
        "name": "oldRescuer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "oldProposedRescuer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newProposedRescuer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RescueModeSet",
    "inputs": [
      {
        "name": "value",
        "type": "bool",
        "indexed": true,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TreasuryPriceIndexSetAt",
    "inputs": [
      {
        "name": "oldTpi",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "newTpiTarget",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "targetTime",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BreachedMaxTpiDelta",
    "inputs": [
      {
        "name": "oldTpi",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "newTpi",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "maxDelta",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "BreachedMaxTpiRateOfChange",
    "inputs": [
      {
        "name": "targetRateOfChange",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "maxRateOfChange",
        "type": "uint96",
        "internalType": "uint96"
      }
    ]
  },
  {
    "type": "error",
    "name": "BreachedMinDateDelta",
    "inputs": [
      {
        "name": "targetTime",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "currentDate",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxTargetTimeDelta",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  }
] as const;
