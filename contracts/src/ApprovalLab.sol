// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IFINSToken is IERC20 {
    function mintCompletionReward(address student) external;
}

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
 * The round-2 fields and entry point are retained as optional legacy telemetry, but they
 * are not part of Activity completion.
 */
contract ApprovalLab is ERC721 {
    using Strings for uint256;
    using Strings for address;

    address public immutable operator;
    /// @notice The new valueless FINS classroom token.
    IFINSToken public immutable token;
    /// @notice The existing Sepolia course AUD token.
    IERC20 public immutable audToken;
    IDrainer public immutable round1Drainer;
    IDrainer public immutable round2Drainer;
    IDrainer public immutable audRound1Drainer;
    IDrainer public immutable audRound2Drainer;

    mapping(address => uint64) public round2EnteredBlock;
    mapping(address => uint64) public revokedAt;
    mapping(address => bool) public alternativeGranted;
    mapping(address => uint256) public badgeOf;
    uint256 private _nextBadgeId;

    event Round2Started(address indexed student, uint64 timestamp, uint64 blockNumber);
    event RecoveryCompleted(address indexed student, uint64 timestamp, uint64 secondsExposed);
    event AlternativeGranted(address indexed student);
    event CompletionRewardClaimed(address indexed student, uint256 indexed badgeId, uint256 finsAmount);

    error NotOperator();
    error ZeroAddress();
    error NeverDrained();
    error LabIncomplete();
    error RewardAlreadyClaimed();
    error BadgeNonTransferable();
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
    ) ERC721("FINSCRYPTO Labs Survivor", "FINS-SURVIVOR") {
        if (
            operator_ == address(0) || token_ == address(0) || audToken_ == address(0) || round1Drainer_ == address(0)
                || round2Drainer_ == address(0) || audRound1Drainer_ == address(0) || audRound2Drainer_ == address(0)
        ) revert ZeroAddress();
        operator = operator_;
        token = IFINSToken(token_);
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

    /// @notice What Activity verification reads.
    function hasCompleted(address student) external view returns (bool) {
        return progressOf(student).complete;
    }

    /// @notice After the complete recovery exercise, mint 500 FINS and one survivor badge atomically.
    function claimCompletionReward() external {
        if (!progressOf(msg.sender).complete) revert LabIncomplete();
        if (badgeOf[msg.sender] != 0) revert RewardAlreadyClaimed();

        _award(msg.sender, true);
    }

    /// @notice Staff-sponsored completion airdrop. Incomplete and already-awarded wallets are skipped.
    /// @dev Uses `_mint` so one smart-contract wallet cannot block the rest of a class batch.
    function airdropCompletionRewards(address[] calldata students) external returns (uint256 awarded) {
        if (msg.sender != operator) revert NotOperator();
        for (uint256 i = 0; i < students.length; i++) {
            address student = students[i];
            if (badgeOf[student] != 0 || !progressOf(student).complete) continue;
            _award(student, false);
            awarded++;
        }
    }

    function _award(address student, bool safe) internal {
        uint256 badgeId = ++_nextBadgeId;
        badgeOf[student] = badgeId;
        token.mintCompletionReward(student);
        if (safe) {
            _safeMint(student, badgeId);
        } else {
            _mint(student, badgeId);
        }

        emit CompletionRewardClaimed(student, badgeId, 500e18);
    }

    /// @notice Fully on-chain metadata: the badge remains visible even if the course site is offline.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address student = ownerOf(tokenId);
        string memory svg = _badgeSvg(tokenId, student);
        string memory json = string.concat(
            '{"name":"I Survived a Hack #',
            tokenId.toString(),
            '","description":"A FINS3647/FINS5547 Sepolia completion badge for recovering course FINS and AUD from a simulated malicious approval. No native ETH was taken.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Course","value":"FINS3647 / FINS5547"},{"trait_type":"Network","value":"Sepolia"},{"trait_type":"Lesson","value":"ERC-20 approvals"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
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

    /// @dev Completion credentials stay with the wallet that earned them.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert BadgeNonTransferable();
        return super._update(to, tokenId, auth);
    }

    function _badgeSvg(uint256 tokenId, address student) internal pure returns (string memory) {
        string memory header = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">',
            '<rect width="1000" height="1000" fill="#f7f3e8"/><rect x="24" y="24" width="952" height="952" fill="none" stroke="#111" stroke-width="18"/>',
            '<rect x="62" y="62" width="876" height="172" fill="#ffdf64" stroke="#111" stroke-width="10"/>',
            '<text x="500" y="168" text-anchor="middle" font-family="Arial,sans-serif" font-size="82" font-weight="900" fill="#111">I SURVIVED A HACK</text>',
            '<rect x="275" y="218" width="450" height="78" fill="#ffd6dd" stroke="#111" stroke-width="9"/>',
            '<text x="500" y="269" text-anchor="middle" font-family="monospace" font-size="38" font-weight="700" fill="#111">FINSCRYPTO LABS</text>'
        );
        string memory illustration = string.concat(
            '<path d="M500 340 690 420v170c0 138-81 225-190 276-109-51-190-138-190-276V420Z" fill="#ffdf64" stroke="#111" stroke-width="14"/>',
            '<path d="M500 380 642 440v143c0 101-55 171-142 219-87-48-142-118-142-219V440Z" fill="#2457d6" stroke="#111" stroke-width="11"/>',
            '<rect x="457" y="535" width="86" height="105" rx="10" fill="#f7f3e8" stroke="#111" stroke-width="10"/>',
            '<path d="M475 535v-33c0-35 50-35 50 0v33" fill="none" stroke="#111" stroke-width="10"/>',
            '<path d="M746 379c80 78 42 174-11 205l-37-58c27-17 36-63 4-94Z" fill="#111"/><path d="m704 480 50 62-32 24-45-65Z" fill="#ffd6dd" stroke="#111" stroke-width="8"/>',
            '<circle cx="214" cy="620" r="79" fill="#ffdf64" stroke="#111" stroke-width="11"/><text x="214" y="640" text-anchor="middle" font-family="monospace" font-size="45" font-weight="800">FINS</text>',
            '<circle cx="786" cy="690" r="79" fill="#bcebd8" stroke="#111" stroke-width="11"/><text x="786" y="710" text-anchor="middle" font-family="monospace" font-size="45" font-weight="800">AUD</text>'
        );
        string memory footer = string.concat(
            '<rect x="62" y="868" width="876" height="70" fill="#e6ecff" stroke="#111" stroke-width="9"/>',
            '<text x="500" y="910" text-anchor="middle" font-family="monospace" font-size="27" font-weight="700">FINS3647 / FINS5547 &#183; SEPOLIA &#183; #',
            tokenId.toString(),
            '</text><text x="500" y="958" text-anchor="middle" font-family="monospace" font-size="18" fill="#333">',
            student.toHexString(),
            "</text></svg>"
        );
        return string.concat(header, illustration, footer);
    }
}
