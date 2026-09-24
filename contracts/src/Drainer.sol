// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Drainer
 * @notice The contract a Student approves during the Approval & Drain Lab, and the
 *         contract that then takes everything.
 *
 * There is no exploit here. Every line uses ERC-20 exactly as intended: once a Student
 * signs `approve(drainer, type(uint256).max)`, this contract can call `transferFrom` on
 * their balance at any time, with no further signature, until they revoke.
 *
 * Ethics: Sepolia only. Every instance is permanently bound to one explicit course ERC-20;
 * the lab deploys separate instances for FINS and the existing course AUD. Everything taken
 * is owed back, and the Student can take it back themselves with `claimRefund`. `sweep` skips
 * anyone it cannot pull from rather than reverting the whole class's batch, and `shutdown`
 * retires the contract for good. Native Sepolia ETH is rejected and never transferred.
 *
 * Note what `shutdown` does NOT do: it cannot revoke anyone's approval. Only the wallet
 * that granted an allowance can set it back to zero. Shutting down makes the allowance
 * harmless; it does not make it disappear from the Student's wallet.
 */
contract Drainer {
    using SafeERC20 for IERC20;

    address public immutable operator;
    IERC20 public immutable token;
    address public immutable treasury;
    string public label;

    /// @notice True once staff retire this contract. It can never sweep again.
    bool public isShutdown;

    mapping(address => uint64) public drainedAt;
    mapping(address => uint256) public drainedAmount;
    mapping(address => uint256) public refundedAmount;

    /// @notice Block of the most recent sweep attempt, successful or not.
    /// @dev Retained for optional round-2 telemetry; it is not required for lab completion.
    uint64 public lastSweepBlock;
    uint64 public sweepRuns;

    event Drained(address indexed victim, address indexed token, uint256 amount);
    event DrainSkipped(address indexed victim, address indexed token, string reason);
    event Refunded(address indexed victim, address indexed token, uint256 amount);
    event SweepRun(uint64 indexed run, uint64 blockNumber, uint256 victimCount);
    event Shutdown(address indexed by);

    error NotOperator();
    error DrainerShutdown();
    error NothingOwed();
    error NativeEthNotAccepted();
    error ZeroAddress();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @param token_ The only ERC-20 this teaching contract can ever move.
    /// @param treasury_ Where swept funds sit. Pass address(0) to hold them in this contract.
    constructor(address operator_, address token_, address treasury_, string memory label_) {
        if (operator_ == address(0) || token_ == address(0)) revert ZeroAddress();
        operator = operator_;
        token = IERC20(token_);
        treasury = treasury_ == address(0) ? address(this) : treasury_;
        label = label_;
    }

    /// @dev Sepolia ETH is gas for Students' recovery transactions, never a lab asset.
    receive() external payable {
        revert NativeEthNotAccepted();
    }

    fallback() external payable {
        revert NativeEthNotAccepted();
    }

    /// @notice Take the configured ERC-20 balance. No caller can substitute another token.
    function sweep(address[] calldata victims) external onlyOperator {
        if (isShutdown) revert DrainerShutdown();
        IERC20 t = token;
        address tokenAddress = address(t);

        for (uint256 i = 0; i < victims.length; i++) {
            address victim = victims[i];

            uint256 allowed = t.allowance(victim, address(this));
            if (allowed == 0) {
                emit DrainSkipped(victim, tokenAddress, "no allowance");
                continue;
            }

            uint256 balance = t.balanceOf(victim);
            if (balance == 0) {
                emit DrainSkipped(victim, tokenAddress, "no balance");
                continue;
            }

            uint256 amount = allowed < balance ? allowed : balance;

            try t.transferFrom(victim, treasury, amount) returns (bool ok) {
                if (!ok) {
                    emit DrainSkipped(victim, tokenAddress, "transferFrom returned false");
                    continue;
                }
            } catch {
                emit DrainSkipped(victim, tokenAddress, "transferFrom reverted");
                continue;
            }

            // Only the first drain sets the timestamp exposure is measured from.
            if (drainedAt[victim] == 0) drainedAt[victim] = uint64(block.timestamp);
            drainedAmount[victim] += amount;

            emit Drained(victim, tokenAddress, amount);
        }

        lastSweepBlock = uint64(block.number);
        sweepRuns += 1;
        emit SweepRun(sweepRuns, uint64(block.number), victims.length);
    }

    /// @notice What this contract still owes a Student: everything taken, minus anything returned.
    function owedTo(address student) public view returns (uint256) {
        return drainedAmount[student] - refundedAmount[student];
    }

    /// @notice Student self-service: give me back what you took.
    /// @dev Works after `shutdown` too; retiring the contract must never strand anyone's tokens.
    function claimRefund() external {
        if (owedTo(msg.sender) == 0) revert NothingOwed();
        _refund(msg.sender);
    }

    /// @notice Staff batch refund for the whole class. Skips anyone already made whole.
    function refund(address[] calldata victims) external onlyOperator {
        for (uint256 i = 0; i < victims.length; i++) {
            if (owedTo(victims[i]) != 0) _refund(victims[i]);
        }
    }

    /// @notice Retire this drainer permanently. Sweeps stop; refunds keep working.
    function shutdown() external onlyOperator {
        if (isShutdown) return;
        isShutdown = true;
        emit Shutdown(msg.sender);
    }

    function hasDrained(address student) external view returns (bool) {
        return drainedAt[student] != 0;
    }

    function _refund(address student) internal {
        uint256 amount = owedTo(student);
        // Effects before interaction: record the refund, then transfer.
        refundedAmount[student] += amount;

        IERC20 t = token;
        if (treasury == address(this)) {
            t.safeTransfer(student, amount);
        } else {
            t.safeTransferFrom(treasury, student, amount);
        }
        emit Refunded(student, address(t), amount);
    }
}
