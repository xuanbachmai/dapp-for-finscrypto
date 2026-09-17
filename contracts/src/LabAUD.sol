// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LabAUD
 * @notice A worthless testnet ERC-20 that stands in for money in the Approval & Drain Lab.
 *
 * This is a completely ordinary ERC-20. The lab does not work because the token is
 * special or broken. It works because `approve` does exactly what the standard says:
 * it lets you hand someone permission to move your whole balance, forever, in one
 * signature.
 */
contract LabAUD is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 5_000e18;

    address public immutable operator;
    mapping(address => bool) public hasClaimed;

    event FaucetClaimed(address indexed student, uint256 amount);

    error AlreadyClaimed();
    error NotOperator();

    constructor(address operator_) ERC20("Lab AUD", "LAUD") {
        operator = operator_;
    }

    /// @notice Give the caller a starting balance to lose. Once per address.
    function claimFaucet() external {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Staff top-up, e.g. to reset a Student mid-class.
    function mint(address to, uint256 amount) external {
        if (msg.sender != operator) revert NotOperator();
        _mint(to, amount);
    }
}
