export const approvalLabAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "operator_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "token_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "audToken_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "round1Drainer_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "round2Drainer_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "audRound1Drainer_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "audRound2Drainer_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "alternativeGranted",
    "inputs": [
      {
        "name": "",
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
    "name": "audRound1Drainer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IDrainer"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "audRound2Drainer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IDrainer"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "audToken",
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
    "name": "completeRecovery",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enterRound2",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "grantAlternative",
    "inputs": [
      {
        "name": "student",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasCompleted",
    "inputs": [
      {
        "name": "student",
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
    "name": "operator",
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
    "name": "progressOf",
    "inputs": [
      {
        "name": "student",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct ApprovalLab.Progress",
        "components": [
          {
            "name": "drained",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "revoked",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "round2Started",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "round2Tested",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "round2Passed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "fundsRecovered",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "complete",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "secondsExposed",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "round1Allowance",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "round2Allowance",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "audRound1Allowance",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "audRound2Allowance",
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
    "name": "revokedAt",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "round1Drainer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IDrainer"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "round2Drainer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IDrainer"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "round2EnteredBlock",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
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
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AlternativeGranted",
    "inputs": [
      {
        "name": "student",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RecoveryCompleted",
    "inputs": [
      {
        "name": "student",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "secondsExposed",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Round2Started",
    "inputs": [
      {
        "name": "student",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "blockNumber",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "NeverDrained",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOperator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RecoveryNotDone",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StillApproved",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowance",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const
