// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IFINSTokenReward {
    function mintCompletionReward(address student) external;
}

interface IApprovalLab {
    function hasCompleted(address student) external view returns (bool);
}

/**
 * @title SurvivorBadge
 * @notice The completion airdrop for the Approval & Drain Lab, as its own dapp: a
 *         non-transferable "I Survived" ERC-721 plus a 500-FINS gift.
 *
 * This contract owns the reward so the lab contract can stay pure lab-state. It reads
 * completion from `ApprovalLab.hasCompleted(student)` — the same gate Activity
 * verification uses — and is the sole `completionMinter` on the FINS token.
 *
 * The badge is soulbound: completion credentials stay with the wallet that earned them.
 * Metadata and artwork are generated fully on-chain, so the badge remains visible even if
 * the course site is offline.
 */
contract SurvivorBadge is ERC721 {
    using Strings for uint256;
    using Strings for address;

    address public immutable operator;
    IFINSTokenReward public immutable token;
    IApprovalLab public immutable lab;

    uint256 public constant FINS_REWARD = 500e18;

    mapping(address => uint256) public badgeOf;
    uint256 private _nextBadgeId;

    event CompletionRewardClaimed(address indexed student, uint256 indexed badgeId, uint256 finsAmount);

    error NotOperator();
    error ZeroAddress();
    error LabIncomplete();
    error RewardAlreadyClaimed();
    error BadgeNonTransferable();

    constructor(address operator_, address token_, address lab_) ERC721("FINSCRYPTO.XYZ Survivor", "FINS-SURVIVOR") {
        if (operator_ == address(0) || token_ == address(0) || lab_ == address(0)) revert ZeroAddress();
        operator = operator_;
        token = IFINSTokenReward(token_);
        lab = IApprovalLab(lab_);
    }

    /// @notice Whether this wallet already holds its survivor badge. Read by Activity verification.
    function hasBadge(address student) external view returns (bool) {
        return badgeOf[student] != 0;
    }

    /// @notice Student self-claim after finishing the recovery exercise: 500 FINS and one badge, atomically.
    function claim() external {
        if (!lab.hasCompleted(msg.sender)) revert LabIncomplete();
        if (badgeOf[msg.sender] != 0) revert RewardAlreadyClaimed();
        _award(msg.sender, true);
    }

    /// @notice Staff-sponsored airdrop. Incomplete and already-awarded wallets are skipped.
    /// @dev Uses `_mint` so one smart-contract wallet cannot block the rest of a class batch.
    function airdrop(address[] calldata students) external returns (uint256 awarded) {
        if (msg.sender != operator) revert NotOperator();
        for (uint256 i = 0; i < students.length; i++) {
            address student = students[i];
            if (badgeOf[student] != 0 || !lab.hasCompleted(student)) continue;
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
        emit CompletionRewardClaimed(student, badgeId, FINS_REWARD);
    }

    /// @notice Fully on-chain metadata: the badge remains visible even if the course site is offline.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address student = ownerOf(tokenId);
        string memory svg = _badgeSvg(tokenId, student);
        string memory json = string.concat(
            '{"name":"I Survived #',
            tokenId.toString(),
            '","description":"A FINS3647/FINS5547 Sepolia completion badge for recovering course FINS and AUD from a simulated malicious approval. No native ETH was taken.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Course","value":"FINS3647 / FINS5547"},{"trait_type":"Network","value":"Sepolia"},{"trait_type":"Lesson","value":"ERC-20 approvals"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
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
            '<text x="500" y="168" text-anchor="middle" font-family="Arial,sans-serif" font-size="96" font-weight="900" fill="#111">I SURVIVED</text>',
            '<rect x="275" y="218" width="450" height="78" fill="#ffd6dd" stroke="#111" stroke-width="9"/>',
            '<text x="500" y="269" text-anchor="middle" font-family="monospace" font-size="38" font-weight="700" fill="#111">FINSCRYPTO.XYZ</text>'
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
