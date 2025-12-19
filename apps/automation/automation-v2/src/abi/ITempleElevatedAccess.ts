export const ABI = [
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
  }
] as const;
