export const ABI = [
  {
    "type": "function",
    "name": "accountData",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "data",
        "type": "tuple",
        "internalType": "struct ITlcDataTypes.AccountData",
        "components": [
          {
            "name": "collateral",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "debtCheckpoint",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "interestAccumulator",
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
    "name": "accountPosition",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "position",
        "type": "tuple",
        "internalType": "struct ITlcDataTypes.AccountPosition",
        "components": [
          {
            "name": "collateral",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "currentDebt",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxBorrow",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "healthFactor",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "loanToValueRatio",
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
    "name": "addCollateral",
    "inputs": [
      {
        "name": "collateralAmount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "onBehalfOf",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "batchLiquidate",
    "inputs": [
      {
        "name": "accounts",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [
      {
        "name": "totalCollateralClaimed",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "totalDaiDebtWiped",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "borrow",
    "inputs": [
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "circuitBreakerProxy",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITempleCircuitBreakerProxy"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "computeLiquidity",
    "inputs": [
      {
        "name": "accounts",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [
      {
        "name": "status",
        "type": "tuple[]",
        "internalType": "struct ITlcDataTypes.LiquidationStatus[]",
        "components": [
          {
            "name": "hasExceededMaxLtv",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "collateral",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "collateralValue",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "currentDebt",
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
    "name": "daiToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "debtTokenDetails",
    "inputs": [],
    "outputs": [
      {
        "name": "config",
        "type": "tuple",
        "internalType": "struct ITlcDataTypes.DebtTokenConfig",
        "components": [
          {
            "name": "maxLtvRatio",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "interestRateModel",
            "type": "address",
            "internalType": "contract IInterestRateModel"
          },
          {
            "name": "borrowsPaused",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      },
      {
        "name": "data",
        "type": "tuple",
        "internalType": "struct ITlcDataTypes.DebtTokenData",
        "components": [
          {
            "name": "interestAccumulatorUpdatedAt",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "totalDebt",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "interestRate",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "interestAccumulator",
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
    "name": "liquidationsPaused",
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
    "name": "minBorrowAmount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recoverToken",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
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
    "name": "refreshInterestRates",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeCollateral",
    "inputs": [
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "repay",
    "inputs": [
      {
        "name": "repayAmount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "onBehalfOf",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "repayAll",
    "inputs": [
      {
        "name": "onBehalfOf",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setBorrowPaused",
    "inputs": [
      {
        "name": "isPaused",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setInterestRateModel",
    "inputs": [
      {
        "name": "interestRateModel",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setLiquidationsPaused",
    "inputs": [
      {
        "name": "isPaused",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMaxLtvRatio",
    "inputs": [
      {
        "name": "maxLtvRatio",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinBorrowAmount",
    "inputs": [
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTlcStrategy",
    "inputs": [
      {
        "name": "_tlcStrategy",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "templeToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tlcStrategy",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITlcStrategy"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalCollateral",
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
    "name": "totalDebtPosition",
    "inputs": [],
    "outputs": [
      {
        "name": "daiPosition",
        "type": "tuple",
        "internalType": "struct ITlcDataTypes.TotalDebtPosition",
        "components": [
          {
            "name": "utilizationRatio",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "borrowRate",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalDebt",
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
    "name": "treasuryReservesVault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITreasuryReservesVault"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Borrow",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BorrowPausedSet",
    "inputs": [
      {
        "name": "isPaused",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CollateralAdded",
    "inputs": [
      {
        "name": "fundedBy",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "onBehalfOf",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "collateralAmount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CollateralRemoved",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "collateralAmount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "InterestRateModelSet",
    "inputs": [
      {
        "name": "interestRateModel",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "InterestRateUpdate",
    "inputs": [
      {
        "name": "newInterestRate",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Liquidated",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "collateralSeized",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "collateralValue",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "daiDebtWiped",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LiquidationsPausedSet",
    "inputs": [
      {
        "name": "isPaused",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MaxLtvRatioSet",
    "inputs": [
      {
        "name": "maxLtvRatio",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MinBorrowAmountSet",
    "inputs": [
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Repay",
    "inputs": [
      {
        "name": "fundedBy",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "onBehalfOf",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "repayAmount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TlcStrategySet",
    "inputs": [
      {
        "name": "strategy",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "treasuryReservesVault",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ExceededBorrowedAmount",
    "inputs": [
      {
        "name": "totalDebtAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "repayAmount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ExceededMaxLtv",
    "inputs": [
      {
        "name": "collateralAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "collateralValue",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "currentDaiDebt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientAmount",
    "inputs": [
      {
        "name": "required",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "provided",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "Paused",
    "inputs": []
  }
] as const;
