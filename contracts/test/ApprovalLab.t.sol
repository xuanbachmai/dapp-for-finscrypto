// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/FINSToken.sol";
import "../src/Drainer.sol";
import "../src/FakeAirdrop.sol";
import "../src/ApprovalLab.sol";

contract CourseAUD is ERC20 {
    constructor() ERC20("The Australian Dollar Token", "AUD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ApprovalLabTest is Test {
    uint256 constant MAX = type(uint256).max;
    uint256 constant FAUCET = 5_000e18;

    address operator = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);

    FINSToken token;
    CourseAUD aud;
    Drainer round1;
    Drainer round2;
    Drainer audRound1;
    Drainer audRound2;
    FakeAirdrop airdrop;
    ApprovalLab lab;

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
        token.configureCompletionMinter(address(lab));

        vm.prank(alice);
        token.claimFaucet();
        vm.prank(bob);
        token.claimFaucet();
        vm.prank(carol);
        token.claimFaucet();
    }

    // --- helpers -----------------------------------------------------------------

    function _one(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _two(address a, address b) internal pure returns (address[] memory list) {
        list = new address[](2);
        list[0] = a;
        list[1] = b;
    }

    function _fallForRound1(address student) internal {
        vm.startPrank(student);
        airdrop.claim();
        token.approve(address(round1), MAX);
        vm.stopPrank();
        round1.sweep(_one(student));
    }

    function _revokeAndRecover(address student) internal {
        vm.startPrank(student);
        token.approve(address(round1), 0);
        lab.completeRecovery();
        vm.stopPrank();
    }

    function _enterRound2(address student) internal {
        vm.roll(block.number + 1);
        vm.prank(student);
        lab.enterRound2();
    }

    function _sweepRound2(address student) internal {
        vm.roll(block.number + 1);
        round2.sweep(_one(student));
        audRound2.sweep(_one(student));
    }

    function _complete(address student) internal {
        _finishAndRecover(student);
    }

    function _finishAndRecover(address student) internal {
        _fallForRound1(student);
        _revokeAndRecover(student);
        vm.prank(student);
        round1.claimRefund();
    }

    // --- round 1: the drain -----------------------------------------------------------

    function testInfiniteApprovalLosesWholeBalance() public {
        _fallForRound1(alice);
        assertEq(token.balanceOf(alice), 0, "whole balance should be taken");
        assertEq(round1.drainedAmount(alice), FAUCET);
        assertTrue(round1.hasDrained(alice));
    }

    function testDrainerCannotTouchAnUnrelatedToken() public {
        FINSToken unrelated = new FINSToken(operator);
        vm.startPrank(alice);
        unrelated.claimFaucet();
        unrelated.approve(address(round1), MAX);
        vm.stopPrank();

        round1.sweep(_one(alice));

        assertEq(unrelated.balanceOf(alice), FAUCET, "unrelated token must remain untouched");
        assertEq(unrelated.allowance(alice, address(round1)), MAX, "unrelated approval is not consumed");
        assertEq(token.balanceOf(alice), FAUCET, "configured FINS also stays put without approval");
        assertFalse(round1.hasDrained(alice));
    }

    function testCourseAudUsesDedicatedDrainerAndRefundAccounting() public {
        aud.mint(alice, 750e18);

        vm.startPrank(alice);
        aud.approve(address(audRound1), MAX);
        vm.stopPrank();
        audRound1.sweep(_one(alice));

        assertEq(aud.balanceOf(alice), 0, "approved course AUD is swept");
        assertEq(token.balanceOf(alice), FAUCET, "FINS stays in its own drainer");
        assertEq(audRound1.owedTo(alice), 750e18);

        vm.prank(alice);
        audRound1.claimRefund();
        assertEq(aud.balanceOf(alice), 750e18, "every AUD is returned");
        assertEq(audRound1.owedTo(alice), 0);
    }

    function testClaimRecordsAttemptButSendsNothing() public {
        vm.prank(alice);
        airdrop.claim();
        assertEq(token.balanceOf(alice), FAUCET, "the promised airdrop never arrives");
        assertTrue(airdrop.hasAttempted(alice));
        assertEq(airdrop.totalAttempts(), 1);

        vm.prank(alice);
        airdrop.claim();
        assertEq(airdrop.claimants().length, 1, "repeat clicks do not duplicate claimants");
    }

    function testSweepSkipsStudentsWhoRevokedWithoutRevertingBatch() public {
        vm.prank(alice);
        token.approve(address(round1), MAX);
        vm.startPrank(bob);
        token.approve(address(round1), MAX);
        token.approve(address(round1), 0);
        vm.stopPrank();

        round1.sweep(_two(alice, bob));

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), FAUCET, "bob revoked in time");
        assertFalse(round1.hasDrained(bob));
    }

    function testRefundReturnsEverythingOnce() public {
        _fallForRound1(alice);
        round1.refund(_one(alice));
        round1.refund(_one(alice));
        assertEq(token.balanceOf(alice), FAUCET, "refunded exactly once");
        assertEq(round1.owedTo(alice), 0);
    }

    // --- refunds: student self-service ----------------------------------------------------

    function testStudentClaimsOwnRefund() public {
        _fallForRound1(alice);
        assertEq(round1.owedTo(alice), FAUCET);

        vm.prank(alice);
        round1.claimRefund();

        assertEq(token.balanceOf(alice), FAUCET, "student recovered everything");
        assertEq(round1.owedTo(alice), 0);
        assertEq(round1.refundedAmount(alice), FAUCET);
    }

    function testClaimRefundTwiceReverts() public {
        _fallForRound1(alice);
        vm.startPrank(alice);
        round1.claimRefund();
        vm.expectRevert(Drainer.NothingOwed.selector);
        round1.claimRefund();
        vm.stopPrank();
    }

    function testStudentNeverDrainedCannotClaim() public {
        vm.prank(bob);
        vm.expectRevert(Drainer.NothingOwed.selector);
        round1.claimRefund();
    }

    function testRefundedStudentDrainedAgainIsOwedTheNewAmount() public {
        _fallForRound1(alice);
        vm.prank(alice);
        round1.claimRefund();

        // Allowance is still open, so a second sweep takes the refund straight back.
        round1.sweep(_one(alice));
        assertEq(round1.owedTo(alice), FAUCET, "second drain is owed, not lost");

        round1.refund(_one(alice));
        assertEq(token.balanceOf(alice), FAUCET);
        assertEq(round1.owedTo(alice), 0);
    }

    function testStudentRefundAndStaffRefundDoNotDoublePay() public {
        _fallForRound1(alice);
        _fallForRound1(bob);
        vm.prank(alice);
        round1.claimRefund();

        round1.refund(_two(alice, bob));

        assertEq(token.balanceOf(alice), FAUCET, "alice paid once");
        assertEq(token.balanceOf(bob), FAUCET);
        assertEq(token.balanceOf(address(round1)), 0, "drainer holds nothing extra");
    }

    function testRefundDoesNotUndoLabProgress() public {
        _complete(alice);
        assertTrue(round1.hasDrained(alice), "the drain still happened");
        assertTrue(lab.hasCompleted(alice));
    }

    // --- shutdown ---------------------------------------------------------------------

    function testShutdownStopsSweeps() public {
        vm.prank(alice);
        token.approve(address(round1), MAX);

        round1.shutdown();
        assertTrue(round1.isShutdown());

        vm.expectRevert(Drainer.DrainerShutdown.selector);
        round1.sweep(_one(alice));
        assertEq(token.balanceOf(alice), FAUCET, "open approval is now harmless");
    }

    function testShutdownCannotRevokeStudentApproval() public {
        vm.prank(alice);
        token.approve(address(round1), MAX);
        round1.shutdown();
        assertEq(token.allowance(alice, address(round1)), MAX, "only the wallet owner can revoke");
    }

    function testRefundsStillWorkAfterShutdown() public {
        _fallForRound1(alice);
        round1.shutdown();
        vm.prank(alice);
        round1.claimRefund();
        assertEq(token.balanceOf(alice), FAUCET);
    }

    function testOnlyOperatorCanShutdown() public {
        vm.prank(alice);
        vm.expectRevert(Drainer.NotOperator.selector);
        round1.shutdown();
    }

    function testSecondSweepKeepsFirstDrainTimestamp() public {
        _fallForRound1(alice);
        uint64 first = round1.drainedAt(alice);

        token.mint(alice, FAUCET);
        vm.warp(block.timestamp + 1 hours);
        round1.sweep(_one(alice));

        assertEq(round1.drainedAt(alice), first, "exposure is measured from the first drain");
        assertEq(round1.drainedAmount(alice), FAUCET * 2);
    }

    function testOnlyOperatorCanSweep() public {
        vm.prank(alice);
        vm.expectRevert(Drainer.NotOperator.selector);
        round1.sweep(_one(alice));
    }

    function testDrainerRejectsNativeEth() public {
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        (bool sent, bytes memory reason) = address(round1).call{value: 0.25 ether}("");

        assertFalse(sent, "drainer must never accept Sepolia ETH");
        assertEq(bytes4(reason), Drainer.NativeEthNotAccepted.selector);
        assertEq(alice.balance, 1 ether, "student keeps ETH for recovery gas");
        assertEq(address(round1).balance, 0);
    }

    function testTokenSweepDoesNotTouchStudentsNativeEth() public {
        vm.deal(alice, 1 ether);
        _fallForRound1(alice);
        assertEq(alice.balance, 1 ether, "Sepolia ETH remains available for recovery gas");
    }

    // --- recovery ------------------------------------------------------------------

    function testRecoveryRefusesWhileApprovedAndNamesSpender() public {
        _fallForRound1(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ApprovalLab.StillApproved.selector, address(round1), MAX));
        lab.completeRecovery();
    }

    function testRecoveryRefusesStudentNeverDrained() public {
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.NeverDrained.selector);
        lab.completeRecovery();
    }

    function testRecoveryRecordsExposureOnceBothApprovalsClear() public {
        _fallForRound1(alice);
        vm.warp(block.timestamp + 120);
        _revokeAndRecover(alice);
        assertEq(lab.progressOf(alice).secondsExposed, 120);

        uint64 first = lab.revokedAt(alice);
        vm.warp(block.timestamp + 600);
        vm.prank(alice);
        lab.completeRecovery();
        assertEq(lab.revokedAt(alice), first, "first revoke time is kept");
    }

    function testRecoveryAlsoRequiresCourseAudApprovalToBeRevoked() public {
        aud.mint(alice, 100e18);
        vm.prank(alice);
        aud.approve(address(audRound1), MAX);
        audRound1.sweep(_one(alice));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ApprovalLab.StillApproved.selector, address(audRound1), MAX));
        lab.completeRecovery();

        vm.startPrank(alice);
        aud.approve(address(audRound1), 0);
        lab.completeRecovery();
        vm.stopPrank();
        assertTrue(lab.progressOf(alice).revoked);
    }

    function testCompletionWaitsUntilEveryDrainedAssetIsRefunded() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);

        assertFalse(lab.progressOf(alice).fundsRecovered, "a balance is still held by the drainer");
        assertFalse(lab.hasCompleted(alice), "no completion reward before recovery");

        vm.prank(alice);
        round1.claimRefund();

        assertTrue(lab.progressOf(alice).fundsRecovered);
        assertTrue(lab.hasCompleted(alice));
    }

    // --- round 2: proving an absence --------------------------------------------------

    function testRound2CannotStartBeforeRecovery() public {
        _fallForRound1(alice);
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.RecoveryNotDone.selector);
        lab.enterRound2();
    }

    function testCompletesWithoutEnteringRound2() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        vm.prank(alice);
        round1.claimRefund();
        assertTrue(lab.hasCompleted(alice));
    }

    function testNotAttackedIsUntestedNotPassed() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        _enterRound2(alice);

        ApprovalLab.Progress memory p = lab.progressOf(alice);
        assertTrue(p.round2Started);
        assertFalse(p.round2Tested, "no sweep has run yet");
        assertFalse(lab.hasCompleted(alice), "resisting an attack requires an attack");
    }

    function testSweepBeforeEnteringDoesNotCount() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        vm.roll(block.number + 1);
        round2.sweep(_one(bob));
        _enterRound2(alice);

        assertFalse(lab.progressOf(alice).round2Tested);
        assertFalse(lab.hasCompleted(alice));
    }

    function testSameBlockSweepDoesNotCount() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        _enterRound2(alice);
        round2.sweep(_one(alice)); // same block as entering

        assertFalse(lab.progressOf(alice).round2Tested, "the attempt must come strictly after");
    }

    function testSigningSecondLureFails() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        _enterRound2(alice);

        token.mint(alice, FAUCET);
        vm.prank(alice);
        token.approve(address(round2), MAX);
        _sweepRound2(alice);

        ApprovalLab.Progress memory p = lab.progressOf(alice);
        assertTrue(p.round2Tested);
        assertFalse(p.round2Passed);
        assertFalse(lab.hasCompleted(alice));
    }

    function testTestedAndRefusedCompletes() public {
        _fallForRound1(alice);
        vm.warp(block.timestamp + 45);
        _revokeAndRecover(alice);
        vm.prank(alice);
        round1.claimRefund();
        _enterRound2(alice);
        token.mint(alice, FAUCET);
        uint256 beforeSweep = token.balanceOf(alice);
        _sweepRound2(alice);

        ApprovalLab.Progress memory p = lab.progressOf(alice);
        assertTrue(p.drained && p.revoked && p.round2Tested && p.round2Passed);
        assertTrue(lab.hasCompleted(alice));
        assertEq(p.secondsExposed, 45);
        assertEq(token.balanceOf(alice), beforeSweep, "round 2 took nothing");
    }

    function testOptionalRound2DoesNotInvalidateCompletion() public {
        _complete(alice);
        assertTrue(lab.hasCompleted(alice));

        _enterRound2(alice);
        assertTrue(lab.hasCompleted(alice), "round 2 is not a completion requirement");
    }

    // --- completion ------------------------------------------------------------------

    function testCompletionRewardMintsFiveHundredFinsAndSurvivorNftOnce() public {
        _finishAndRecover(alice);
        uint256 beforeBalance = token.balanceOf(alice);

        vm.prank(alice);
        lab.claimCompletionReward();

        assertEq(token.balanceOf(alice), beforeBalance + 500e18, "500 FINS completion gift");
        assertEq(lab.balanceOf(alice), 1, "one survivor NFT");
        assertEq(lab.ownerOf(lab.badgeOf(alice)), alice);
        assertTrue(bytes(lab.tokenURI(lab.badgeOf(alice))).length > 100, "on-chain NFT metadata exists");

        vm.prank(alice);
        vm.expectRevert(ApprovalLab.RewardAlreadyClaimed.selector);
        lab.claimCompletionReward();
    }

    function testCompletionRewardCannotBeClaimedEarly() public {
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.LabIncomplete.selector);
        lab.claimCompletionReward();
    }

    function testSurvivorNftCannotBeTransferred() public {
        _finishAndRecover(alice);
        vm.prank(alice);
        lab.claimCompletionReward();

        uint256 badgeId = lab.badgeOf(alice);
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.BadgeNonTransferable.selector);
        lab.transferFrom(alice, bob, badgeId);
    }

    function testOnlyApprovalLabCanMintCompletionFins() public {
        vm.prank(alice);
        vm.expectRevert(FINSToken.NotCompletionMinter.selector);
        token.mintCompletionReward(alice);
    }

    function testOperatorCanAirdropRewardWithoutAnotherStudentTransaction() public {
        _finishAndRecover(alice);
        uint256 beforeBalance = token.balanceOf(alice);

        uint256 awarded = lab.airdropCompletionRewards(_two(alice, bob));

        assertEq(awarded, 1, "incomplete wallets are skipped");
        assertEq(token.balanceOf(alice), beforeBalance + 500e18);
        assertEq(lab.ownerOf(lab.badgeOf(alice)), alice);
        assertEq(lab.badgeOf(bob), 0);
    }

    function testStudentCannotRunCompletionAirdrop() public {
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.NotOperator.selector);
        lab.airdropCompletionRewards(_one(alice));
    }

    function testReapprovingAfterCompletionReadsIncomplete() public {
        _complete(alice);
        vm.prank(alice);
        token.approve(address(round1), MAX);
        assertFalse(lab.hasCompleted(alice), "current state is re-checked on every read");
    }

    function testProgressReportsLiveAllowances() public {
        assertFalse(lab.progressOf(alice).drained);
        assertEq(lab.progressOf(alice).round1Allowance, 0);

        _fallForRound1(alice);
        ApprovalLab.Progress memory p = lab.progressOf(alice);
        assertTrue(p.drained);
        assertEq(p.round1Allowance, MAX, "infinite allowance survives the drain");
    }

    function testStudentsAreIndependent() public {
        _complete(alice);
        _fallForRound1(bob);
        assertTrue(lab.hasCompleted(alice));
        assertFalse(lab.hasCompleted(bob));
    }

    // --- ethics guardrails -----------------------------------------------------------

    function testOptOutStudentCompletes() public {
        lab.grantAlternative(carol);
        assertTrue(lab.hasCompleted(carol));
        assertEq(token.balanceOf(carol), FAUCET, "never touched by the lab");
    }

    function testStudentCannotGrantOwnAlternative() public {
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.NotOperator.selector);
        lab.grantAlternative(alice);
    }
}
