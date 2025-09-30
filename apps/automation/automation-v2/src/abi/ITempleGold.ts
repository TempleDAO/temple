export const ABI = [
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "name": "approvalRequired",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
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
    "name": "auction",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IStableGoldAuction"
      }
    ],
    "stateMutability": "view"
  },
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
    "name": "authorized",
    "inputs": [
      {
        "name": "who",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "name": "burn",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "canDistribute",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "circulatingSupply",
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
    "name": "combineOptions",
    "inputs": [
      {
        "name": "_eid",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "_msgType",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "_extraOptions",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "options",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "endpoint",
    "inputs": [],
    "outputs": [
      {
        "name": "iEndpoint",
        "type": "address",
        "internalType": "contract ILayerZeroEndpointV2"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDistributionParameters",
    "inputs": [],
    "outputs": [
      {
        "name": "",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMintAmount",
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
    "name": "getVestingFactor",
    "inputs": [],
    "outputs": [
      {
        "name": "",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastMintTimestamp",
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
    "name": "mint",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "oAppVersion",
    "inputs": [],
    "outputs": [
      {
        "name": "senderVersion",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "receiverVersion",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "oftVersion",
    "inputs": [],
    "outputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "version",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "peers",
    "inputs": [
      {
        "name": "_eid",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "peer",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteOFT",
    "inputs": [
      {
        "name": "_sendParam",
        "type": "tuple",
        "internalType": "struct SendParam",
        "components": [
          {
            "name": "dstEid",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "to",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "amountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minAmountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "extraOptions",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "composeMsg",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "oftCmd",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct OFTLimit",
        "components": [
          {
            "name": "minAmountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxAmountLD",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "oftFeeDetails",
        "type": "tuple[]",
        "internalType": "struct OFTFeeDetail[]",
        "components": [
          {
            "name": "feeAmountLD",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          }
        ]
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct OFTReceipt",
        "components": [
          {
            "name": "amountSentLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "amountReceivedLD",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteSend",
    "inputs": [
      {
        "name": "_sendParam",
        "type": "tuple",
        "internalType": "struct SendParam",
        "components": [
          {
            "name": "dstEid",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "to",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "amountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minAmountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "extraOptions",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "composeMsg",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "oftCmd",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_payInLzToken",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MessagingFee",
        "components": [
          {
            "name": "nativeFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lzTokenFee",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "send",
    "inputs": [
      {
        "name": "_sendParam",
        "type": "tuple",
        "internalType": "struct SendParam",
        "components": [
          {
            "name": "dstEid",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "to",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "amountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minAmountLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "extraOptions",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "composeMsg",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "oftCmd",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_fee",
        "type": "tuple",
        "internalType": "struct MessagingFee",
        "components": [
          {
            "name": "nativeFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lzTokenFee",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "_refundAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MessagingReceipt",
        "components": [
          {
            "name": "guid",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "nonce",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fee",
            "type": "tuple",
            "internalType": "struct MessagingFee",
            "components": [
              {
                "name": "nativeFee",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "lzTokenFee",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct OFTReceipt",
        "components": [
          {
            "name": "amountSentLD",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "amountReceivedLD",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "payable"
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
    "name": "sharedDecimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "staking",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITempleGoldStaking"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "teamGnosis",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalDistributed",
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
    "name": "totalSupply",
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
    "name": "transfer",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
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
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
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
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CirculatingSupplyUpdated",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "circulatingSuppply",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "totalBurned",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ContractAuthorizationSet",
    "inputs": [
      {
        "name": "_contract",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_whitelisted",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Distributed",
    "inputs": [
      {
        "name": "stakingAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "auctionAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "gnosisAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DistributionParamsSet",
    "inputs": [
      {
        "name": "staking",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "auction",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "gnosis",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EnforcedOptionSet",
    "inputs": [
      {
        "name": "_enforcedOptions",
        "type": "tuple[]",
        "indexed": false,
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
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OFTReceived",
    "inputs": [
      {
        "name": "guid",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "srcEid",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "toAddress",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amountReceivedLD",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OFTSent",
    "inputs": [
      {
        "name": "guid",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "dstEid",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "fromAddress",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amountSentLD",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "amountReceivedLD",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PeerSet",
    "inputs": [
      {
        "name": "eid",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "peer",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "StableGoldAuctionSet",
    "inputs": [
      {
        "name": "auction",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "StakingSet",
    "inputs": [
      {
        "name": "staking",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TeamGnosisSet",
    "inputs": [
      {
        "name": "gnosis",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VestingFactorSet",
    "inputs": [
      {
        "name": "numerator",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "denominator",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "CannotCompose",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDelegate",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidEndpointCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidLocalDecimals",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidOptions",
    "inputs": [
      {
        "name": "options",
        "type": "bytes",
        "internalType": "bytes"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidTotalShare",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MissingParameter",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoPeer",
    "inputs": [
      {
        "name": "eid",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  },
  {
    "type": "error",
    "name": "NonTransferrable",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OnlyPeer",
    "inputs": [
      {
        "name": "eid",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "sender",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "SlippageExceeded",
    "inputs": [
      {
        "name": "amountLD",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "minAmountLD",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "WrongChain",
    "inputs": []
  }
] as const;
