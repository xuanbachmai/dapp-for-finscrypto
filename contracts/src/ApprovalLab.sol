// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDrainer {
    function drainedAt(address student) external view returns (uint64);
    function lastSweepBlock() external view returns (uint64);
}

/**
 * @title ApprovalLab
 * @notice On-chain state for the Approval & Drain Lab Activity.
 *
 * Activity verification runs on the platform server and reads `hasCompleted(wallet)`,
 * the same way the Wave Activity reads `hasWaved(wallet)`. This contract holds no Progress
 * and needs no verify transaction; it only records the two moments that chain state
 * cannot otherwise show.
 *
 * Round 2 passes on an absence: the Student did not sign the second lure. An absence is
 * not an event, so it gets two on-chain bookends instead:
 *   1. The Student calls `enterRound2()`, writing a block only they could have written.
 *   2. Staff sweep from the round-2 drainer after that block. The drainer records the
 *      attempt whether or not it takes anything.
 * An attempt after they started that came away empty is provable. "Nobody attacked you"
 * is not, and is deliberately treated as untested rather than passed.
 */
contract ApprovalLab {
    address public operator;
    IERC20 public immutable token;
    IDrainer public immutable round1Drainer;
    IDrainer public immutable round2Drainer;

    mapping(address => uint64) public round2EnteredBlock;
    mapping(address => uint64) public revokedAt;
    mapping(address => bool) public alternativeGranted;

    event Round2Started(address indexed student, uint64 timestamp, uint64 blockNumber);
    event RecoveryCompleted(address indexed student, uint64 timestamp, uint64 secondsExposed);
    event AlternativeGranted(address indexed student);

    error NotOperator();
    error NeverDrained();
    error StillApproved(address spender, uint256 allowance);
    error RecoveryNotDone();

    struct Progress {
        bool drained;
        bool revoked;
        bool round2Started;
        bool round2Tested;
        bool round2Passed;
        bool complete;
        uint64 secondsExposed;
        uint256 round1Allowance;
        uint256 round2Allowance;
    }

    constructor(address operator_, address token_, address round1Drainer_, address round2Drainer_) {
        operator = operator_;
        token = IERC20(token_);
        round1Drainer = IDrainer(round1Drainer_);
        round2Drainer = IDrainer(round2Drainer_);
    }

    /// @notice Prove every lab approval is revoked. The revert names any spender still open.
    function completeRecovery() external {
        if (round1Drainer.drainedAt(msg.sender) == 0) revert NeverDrained();
        _requireRevoked(msg.sender, address(round1Drainer));
        _requireRevoked(msg.sender, address(round2Drainer));

        if (revokedAt[msg.sender] == 0) revokedAt[msg.sender] = uint64(block.timestamp);
        emit RecoveryCompleted(msg.sender, uint64(block.timestamp), _secondsExposed(msg.sender));
    }

    /// @notice Start round 2. Approves nothing; it is the anchor the absence is measured from.
    /// @dev Re-entering moves the anchor forward, so an older sweep can never count.
    function enterRound2() external {
        if (revokedAt[msg.sender] == 0) revert RecoveryNotDone();
        round2EnteredBlock[msg.sender] = uint64(block.number);
        emit Round2Started(msg.sender, uint64(block.timestamp), uint64(block.number));
    }

    /// @notice What Activity verification reads.
    function hasCompleted(address student) external view returns (bool) {
        return progressOf(student).complete;
    }

    function progressOf(address student) public view returns (Progress memory p) {
        uint64 entered = round2EnteredBlock[student];

        p.drained = round1Drainer.drainedAt(student) != 0;
        p.revoked = revokedAt[student] != 0;
        p.round2Started = entered != 0;
        p.round2Tested = p.round2Started && round2Drainer.lastSweepBlock() > entered;
        p.round2Passed = p.round2Tested && round2Drainer.drainedAt(student) == 0;
        p.secondsExposed = _secondsExposed(student);
        p.round1Allowance = token.allowance(student, address(round1Drainer));
        p.round2Allowance = token.allowance(student, address(round2Drainer));
        p.complete = alternativeGranted[student]
            || (p.drained && p.revoked && p.round2Passed && p.round1Allowance == 0 && p.round2Allowance == 0);
    }

    /// @notice Opt-out path: an equivalent written task, recorded as complete.
    function grantAlternative(address student) external {
        if (msg.sender != operator) revert NotOperator();
        alternativeGranted[student] = true;
        emit AlternativeGranted(student);
    }

    function _requireRevoked(address student, address spender) internal view {
        uint256 allowed = token.allowance(student, spender);
        if (allowed != 0) revert StillApproved(spender, allowed);
    }

    function _secondsExposed(address student) internal view returns (uint64) {
        uint64 drained = round1Drainer.drainedAt(student);
        uint64 revoked = revokedAt[student];
        if (drained == 0 || revoked == 0 || revoked < drained) return 0;
        return revoked - drained;
    }
}
