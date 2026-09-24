// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FINSToken
 * @notice A valueless Sepolia-only ERC-20 used by the Approval & Drain Lab.
 *
 * This is an ordinary ERC-20. The lesson works because `approve` lets a spender
 * move a wallet's tokens with `transferFrom` until that allowance is revoked.
 * FINS issued here is classroom test currency and has no claim on any future token.
 */
contract FINSToken is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 5_000e18;
    uint256 public constant COMPLETION_REWARD = 500e18;

    address public immutable operator;
    address public immutable installer;
    address public completionMinter;
    mapping(address => bool) public hasClaimed;
    mapping(address => bool) public completionRewardMinted;

    event FaucetClaimed(address indexed student, uint256 amount);
    event CompletionMinterConfigured(address indexed minter);
    event CompletionRewardMinted(address indexed student, uint256 amount);

    error AlreadyClaimed();
    error CompletionMinterAlreadyConfigured();
    error CompletionRewardAlreadyMinted();
    error CompletionMinterNotConfigured();
    error NotCompletionMinter();
    error NotInstaller();
    error NotOperator();
    error ZeroAddress();

    constructor(address operator_) ERC20("FINS Course Token", "FINS") {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        installer = msg.sender;
    }

    /// @notice One-time deployment wiring. The lab becomes the only completion-reward minter.
    function configureCompletionMinter(address minter) external {
        if (msg.sender != installer) revert NotInstaller();
        if (minter == address(0)) revert ZeroAddress();
        if (completionMinter != address(0)) revert CompletionMinterAlreadyConfigured();
        completionMinter = minter;
        emit CompletionMinterConfigured(minter);
    }

    /// @notice Give the caller a starting classroom balance. Once per address.
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

    /// @notice Mint the fixed 500-FINS gift after the trusted lab verifies completion.
    function mintCompletionReward(address student) external {
        if (completionMinter == address(0)) revert CompletionMinterNotConfigured();
        if (msg.sender != completionMinter) revert NotCompletionMinter();
        if (completionRewardMinted[student]) revert CompletionRewardAlreadyMinted();
        completionRewardMinted[student] = true;
        _mint(student, COMPLETION_REWARD);
        emit CompletionRewardMinted(student, COMPLETION_REWARD);
    }
}
