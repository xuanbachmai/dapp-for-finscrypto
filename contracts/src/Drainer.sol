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
 * Ethics: testnet only. Everything taken is owed back, and the Student can take it back
 * themselves with `claimRefund`. `sweep` skips anyone it cannot pull from rather than
 * reverting the whole class's batch, and `shutdown` retires the contract for good.
 *
 * Note what `shutdown` does NOT do: it cannot revoke anyone's approval. Only the wallet
 * that granted an allowance can set it back to zero. Shutting down makes the allowance
 * harmless; it does not make it disappear from the Student's wallet.
 */
contract Drainer {
    using SafeERC20 for IERC20;

    address public operator;
    address public treasury;
    string public label;

    /// @notice True once staff retire this contract. It can never sweep again.
    bool public isShutdown;

    mapping(address => uint64) public drainedAt;
    mapping(address => uint256) public drainedAmount;
    mapping(address => uint256) public refundedAmount;

    /// @notice Block of the most recent sweep attempt, successful or not.
    /// @dev Lets ApprovalLab prove an attempt happened after a Student entered round 2.
    ///      Without it, "nobody tried to drain you" and "you refused" look identical.
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

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @param treasury_ Where swept funds sit. Pass address(0) to hold them in this contract.
    constructor(address operator_, address treasury_, string memory label_) {
        operator = operator_;
        treasury = treasury_ == address(0) ? address(this) : treasury_;
        label = label_;
    }

    /// @notice Take everything this contract has been approved to take.
    function sweep(address[] calldata victims, address token) external onlyOperator {
        if (isShutdown) revert DrainerShutdown();
        IERC20 t = IERC20(token);

        for (uint256 i = 0; i < victims.length; i++) {
            address victim = victims[i];

            uint256 allowed = t.allowance(victim, address(this));
            if (allowed == 0) {
                emit DrainSkipped(victim, token, "no allowance");
                continue;
            }

            uint256 balance = t.balanceOf(victim);
            if (balance == 0) {
                emit DrainSkipped(victim, token, "no balance");
                continue;
            }

            uint256 amount = allowed < balance ? allowed : balance;

            try t.transferFrom(victim, treasury, amount) returns (bool ok) {
                if (!ok) {
                    emit DrainSkipped(victim, token, "transferFrom returned false");
                    continue;
                }
            } catch {
                emit DrainSkipped(victim, token, "transferFrom reverted");
                continue;
            }

            // Only the first drain sets the timestamp exposure is measured from.
            if (drainedAt[victim] == 0) drainedAt[victim] = uint64(block.timestamp);
            drainedAmount[victim] += amount;

            emit Drained(victim, token, amount);
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
    function claimRefund(address token) external {
        if (owedTo(msg.sender) == 0) revert NothingOwed();
        _refund(msg.sender, token);
    }

    /// @notice Staff batch refund for the whole class. Skips anyone already made whole.
    function refund(address[] calldata victims, address token) external onlyOperator {
        for (uint256 i = 0; i < victims.length; i++) {
            if (owedTo(victims[i]) != 0) _refund(victims[i], token);
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

    function _refund(address student, address token) internal {
        uint256 amount = owedTo(student);
        // Effects before interaction: record the refund, then transfer.
        refundedAmount[student] += amount;

        IERC20 t = IERC20(token);
        if (treasury == address(this)) {
            t.safeTransfer(student, amount);
        } else {
            t.safeTransferFrom(treasury, student, amount);
        }
        emit Refunded(student, token, amount);
    }
}
