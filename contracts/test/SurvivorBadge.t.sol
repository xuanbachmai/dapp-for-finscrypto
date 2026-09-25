// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/FINSToken.sol";
import "../src/Drainer.sol";
import "../src/FakeAirdrop.sol";
import "../src/ApprovalLab.sol";
import "../src/SurvivorBadge.sol";

contract CourseAUD is ERC20 {
    constructor() ERC20("The Australian Dollar Token", "AUD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// The completion reward is now its own dapp. These tests exercise SurvivorBadge reading
/// ApprovalLab.hasCompleted and minting the 500-FINS gift plus the soulbound badge.
contract SurvivorBadgeTest is Test {
    uint256 constant MAX = type(uint256).max;

    address operator = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    FINSToken token;
    CourseAUD aud;
    Drainer round1;
    Drainer round2;
    Drainer audRound1;
    Drainer audRound2;
    FakeAirdrop airdrop;
    ApprovalLab lab;
    SurvivorBadge badge;

    function setUp() public {
        vm.warp(1_760_000_000);
        token = new FINSToken(operator);
        aud = new CourseAUD();
        round1 = new Drainer(operator, address(token), address(0), "round-1");
        round2 = new Drainer(operator, address(token), address(0), "round-2");
        audRound1 = new Drainer(operator, address(aud), address(0), "round-1: course AUD");
        audRound2 = new Drainer(operator, address(aud), address(0), "round-2: course AUD");
        airdrop = new FakeAirdrop(address(token), address(round1));
        lab = new ApprovalLab(
            operator,
            address(token),
            address(aud),
            address(round1),
            address(round2),
            address(audRound1),
            address(audRound2)
        );
        badge = new SurvivorBadge(operator, address(token), address(lab));
        token.configureCompletionMinter(address(badge));

        vm.prank(alice);
        token.claimFaucet();
        vm.prank(bob);
        token.claimFaucet();
    }

    function _one(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _two(address a, address b) internal pure returns (address[] memory list) {
        list = new address[](2);
        list[0] = a;
        list[1] = b;
    }

    /// Drives a Student through the lab to a completed, fully-refunded state.
    function _finishAndRecover(address student) internal {
        vm.startPrank(student);
        airdrop.claim();
        token.approve(address(round1), MAX);
        vm.stopPrank();
        round1.sweep(_one(student));

        vm.startPrank(student);
        token.approve(address(round1), 0);
        lab.completeRecovery();
        round1.claimRefund();
        vm.stopPrank();

        assertTrue(lab.hasCompleted(student), "precondition: lab complete");
    }

    function testClaimMintsFiveHundredFinsAndSurvivorNftOnce() public {
        _finishAndRecover(alice);
        uint256 beforeBalance = token.balanceOf(alice);

        vm.prank(alice);
        badge.claim();

        assertEq(token.balanceOf(alice), beforeBalance + 500e18, "500 FINS completion gift");
        assertEq(badge.balanceOf(alice), 1, "one survivor NFT");
        assertEq(badge.ownerOf(badge.badgeOf(alice)), alice);
        assertTrue(badge.hasBadge(alice));
        assertTrue(bytes(badge.tokenURI(badge.badgeOf(alice))).length > 100, "on-chain NFT metadata exists");

        vm.prank(alice);
        vm.expectRevert(SurvivorBadge.RewardAlreadyClaimed.selector);
        badge.claim();
    }

    function testClaimRevertsUntilLabComplete() public {
        vm.prank(alice);
        vm.expectRevert(SurvivorBadge.LabIncomplete.selector);
        badge.claim();
    }

    function testBadgeCannotBeTransferred() public {
        _finishAndRecover(alice);
        vm.prank(alice);
        badge.claim();

        uint256 badgeId = badge.badgeOf(alice);
        vm.prank(alice);
        vm.expectRevert(SurvivorBadge.BadgeNonTransferable.selector);
        badge.transferFrom(alice, bob, badgeId);
    }

    function testOnlyBadgeCanMintCompletionFins() public {
        vm.prank(alice);
        vm.expectRevert(FINSToken.NotCompletionMinter.selector);
        token.mintCompletionReward(alice);
    }

    function testOperatorAirdropSkipsIncompleteAndAwardedWallets() public {
        _finishAndRecover(alice);
        uint256 beforeBalance = token.balanceOf(alice);

        uint256 awarded = badge.airdrop(_two(alice, bob));

        assertEq(awarded, 1, "incomplete wallets are skipped");
        assertEq(token.balanceOf(alice), beforeBalance + 500e18);
        assertEq(badge.ownerOf(badge.badgeOf(alice)), alice);
        assertEq(badge.badgeOf(bob), 0);

        // Re-running awards nobody new.
        assertEq(badge.airdrop(_two(alice, bob)), 0, "already-awarded wallets are skipped");
    }

    function testStudentCannotRunAirdrop() public {
        vm.prank(alice);
        vm.expectRevert(SurvivorBadge.NotOperator.selector);
        badge.airdrop(_one(alice));
    }

    function testConstructorRejectsZeroAddresses() public {
        vm.expectRevert(SurvivorBadge.ZeroAddress.selector);
        new SurvivorBadge(operator, address(0), address(lab));
    }
}
