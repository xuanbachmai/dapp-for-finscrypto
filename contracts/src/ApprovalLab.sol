// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDrainer {
    function drainedAt(address student) external view returns (uint64);
    function lastSweepBlock() external view returns (uint64);
    function owedTo(address student) external view returns (uint256);
}

/**
 * @title ApprovalLab
 * @notice On-chain state for the Approval & Drain Lab Activity.
 *
 * Activity verification runs on the platform server and reads `hasCompleted(wallet)`,
 * the same way the Wave Activity reads `hasWaved(wallet)`. This contract holds no Progress
 * and needs no verify transaction. Completion requires a recorded drain, confirmed
 * revocation of every lab approval, and recovery of every token the lab owes.
 *
 * The completion reward (500 FINS + the soulbound "I Survived" badge) lives in a
 * separate `SurvivorBadge` dapp that reads `hasCompleted` from here, so this contract stays
 * pure lab-state and never mints anything.
 *
 * The round-2 fields and entry point are retained as optional legacy telemetry, but they
 * are not part of Activity completion.
 */
contract ApprovalLab {
    address public immutable operator;
    /// @notice The valueless FINS classroom token.
    IERC20 public immutable token;
    /// @notice The existing Sepolia course AUD token.
    IERC20 public immutable audToken;
    IDrainer public immutable round1Drainer;
    IDrainer public immutable round2Drainer;
    IDrainer public immutable audRound1Drainer;
    IDrainer public immutable audRound2Drainer;

    mapping(address => uint64) public round2EnteredBlock;
    mapping(address => uint64) public revokedAt;
    mapping(address => bool) public alternativeGranted;

    event Round2Started(address indexed student, uint64 timestamp, uint64 blockNumber);
    event RecoveryCompleted(address indexed student, uint64 timestamp, uint64 secondsExposed);
    event AlternativeGranted(address indexed student);

    error NotOperator();
    error ZeroAddress();
    error NeverDrained();
    error StillApproved(address spender, uint256 allowance);
    error RecoveryNotDone();

    struct Progress {
        bool drained;
        bool revoked;
        bool round2Started;
        bool round2Tested;
        bool round2Passed;
        bool fundsRecovered;
        bool complete;
        uint64 secondsExposed;
        uint256 round1Allowance;
        uint256 round2Allowance;
        uint256 audRound1Allowance;
        uint256 audRound2Allowance;
    }

    constructor(
        address operator_,
        address token_,
        address audToken_,
        address round1Drainer_,
        address round2Drainer_,
        address audRound1Drainer_,
        address audRound2Drainer_
    ) {
        if (
            operator_ == address(0) || token_ == address(0) || audToken_ == address(0) || round1Drainer_ == address(0)
                || round2Drainer_ == address(0) || audRound1Drainer_ == address(0) || audRound2Drainer_ == address(0)
        ) revert ZeroAddress();
        operator = operator_;
        token = IERC20(token_);
        audToken = IERC20(audToken_);
        round1Drainer = IDrainer(round1Drainer_);
        round2Drainer = IDrainer(round2Drainer_);
        audRound1Drainer = IDrainer(audRound1Drainer_);
        audRound2Drainer = IDrainer(audRound2Drainer_);
    }

    /// @notice Prove every lab approval is revoked. The revert names any spender still open.
    function completeRecovery() external {
        if (round1Drainer.drainedAt(msg.sender) == 0 && audRound1Drainer.drainedAt(msg.sender) == 0) {
            revert NeverDrained();
        }
        _requireRevoked(token, msg.sender, address(round1Drainer));
        _requireRevoked(token, msg.sender, address(round2Drainer));
        _requireRevoked(audToken, msg.sender, address(audRound1Drainer));
        _requireRevoked(audToken, msg.sender, address(audRound2Drainer));

        if (revokedAt[msg.sender] == 0) revokedAt[msg.sender] = uint64(block.timestamp);
        emit RecoveryCompleted(msg.sender, uint64(block.timestamp), _secondsExposed(msg.sender));
    }

    /// @notice Optional legacy round-2 marker; not required for Activity completion.
    /// @dev Re-entering moves the telemetry anchor forward, so an older sweep cannot count.
    function enterRound2() external {
        if (revokedAt[msg.sender] == 0) revert RecoveryNotDone();
        round2EnteredBlock[msg.sender] = uint64(block.number);
        emit Round2Started(msg.sender, uint64(block.timestamp), uint64(block.number));
    }

    /// @notice What Activity verification (and the SurvivorBadge dapp) reads.
    function hasCompleted(address student) external view returns (bool) {
        return progressOf(student).complete;
    }

    function progressOf(address student) public view returns (Progress memory p) {
        uint64 entered = round2EnteredBlock[student];

        p.drained = round1Drainer.drainedAt(student) != 0 || audRound1Drainer.drainedAt(student) != 0;
        p.revoked = revokedAt[student] != 0;
        p.round2Started = entered != 0;
        p.round2Tested =
            p.round2Started && round2Drainer.lastSweepBlock() > entered && audRound2Drainer.lastSweepBlock() > entered;
        p.round2Passed =
            p.round2Tested && round2Drainer.drainedAt(student) == 0 && audRound2Drainer.drainedAt(student) == 0;
        p.fundsRecovered = _allFundsRecovered(student);
        p.secondsExposed = _secondsExposed(student);
        p.round1Allowance = token.allowance(student, address(round1Drainer));
        p.round2Allowance = token.allowance(student, address(round2Drainer));
        p.audRound1Allowance = audToken.allowance(student, address(audRound1Drainer));
        p.audRound2Allowance = audToken.allowance(student, address(audRound2Drainer));
        p.complete = alternativeGranted[student]
            || (p.drained
                && p.revoked
                && p.fundsRecovered
                && p.round1Allowance == 0
                && p.round2Allowance == 0
                && p.audRound1Allowance == 0
                && p.audRound2Allowance == 0);
    }

    /// @notice Opt-out path: an equivalent written task, recorded as complete.
    function grantAlternative(address student) external {
        if (msg.sender != operator) revert NotOperator();
        alternativeGranted[student] = true;
        emit AlternativeGranted(student);
    }

    function _requireRevoked(IERC20 asset, address student, address spender) internal view {
        uint256 allowed = asset.allowance(student, spender);
        if (allowed != 0) revert StillApproved(spender, allowed);
    }

    function _secondsExposed(address student) internal view returns (uint64) {
        uint64 finsDrained = round1Drainer.drainedAt(student);
        uint64 audDrained = audRound1Drainer.drainedAt(student);
        uint64 drained = finsDrained == 0 ? audDrained : audDrained == 0 ? finsDrained : _min(finsDrained, audDrained);
        uint64 revoked = revokedAt[student];
        if (drained == 0 || revoked == 0 || revoked < drained) return 0;
        return revoked - drained;
    }

    function _allFundsRecovered(address student) internal view returns (bool) {
        return round1Drainer.owedTo(student) == 0 && round2Drainer.owedTo(student) == 0
            && audRound1Drainer.owedTo(student) == 0 && audRound2Drainer.owedTo(student) == 0;
    }

    function _min(uint64 a, uint64 b) internal pure returns (uint64) {
        return a < b ? a : b;
    }
}
