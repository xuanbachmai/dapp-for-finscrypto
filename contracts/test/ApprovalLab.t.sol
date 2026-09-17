// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "../src/LabAUD.sol";
import "../src/Drainer.sol";
import "../src/FakeAirdrop.sol";
import "../src/ApprovalLab.sol";

contract ApprovalLabTest is Test {
    uint256 constant MAX = type(uint256).max;
    uint256 constant FAUCET = 5_000e18;

    address operator = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);

    LabAUD token;
    Drainer round1;
    Drainer round2;
    FakeAirdrop airdrop;
    ApprovalLab lab;

    function setUp() public {
        vm.warp(1_760_000_000);
        token = new LabAUD(operator);
        round1 = new Drainer(operator, address(0), "round-1");
        round2 = new Drainer(operator, address(0), "round-2");
        airdrop = new FakeAirdrop(address(token), address(round1));
        lab = new ApprovalLab(operator, address(token), address(round1), address(round2));

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
        round1.sweep(_one(student), address(token));
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
        round2.sweep(_one(student), address(token));
    }

    function _complete(address student) internal {
        _fallForRound1(student);
        _revokeAndRecover(student);
        _enterRound2(student);
        _sweepRound2(student);
    }

    // --- round 1: the drain -----------------------------------------------------------

    function testInfiniteApprovalLosesWholeBalance() public {
        _fallForRound1(alice);
        assertEq(token.balanceOf(alice), 0, "whole balance should be taken");
        assertEq(round1.drainedAmount(alice), FAUCET);
        assertTrue(round1.hasDrained(alice));
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

        round1.sweep(_two(alice, bob), address(token));

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), FAUCET, "bob revoked in time");
        assertFalse(round1.hasDrained(bob));
    }

    function testRefundReturnsEverythingOnce() public {
        _fallForRound1(alice);
        round1.refund(_one(alice), address(token));
        round1.refund(_one(alice), address(token));
        assertEq(token.balanceOf(alice), FAUCET, "refunded exactly once");
        assertEq(round1.owedTo(alice), 0);
    }

    // --- refunds: student self-service ----------------------------------------------------

    function testStudentClaimsOwnRefund() public {
        _fallForRound1(alice);
        assertEq(round1.owedTo(alice), FAUCET);

        vm.prank(alice);
        round1.claimRefund(address(token));

        assertEq(token.balanceOf(alice), FAUCET, "student recovered everything");
        assertEq(round1.owedTo(alice), 0);
        assertEq(round1.refundedAmount(alice), FAUCET);
    }

    function testClaimRefundTwiceReverts() public {
        _fallForRound1(alice);
        vm.startPrank(alice);
        round1.claimRefund(address(token));
        vm.expectRevert(Drainer.NothingOwed.selector);
        round1.claimRefund(address(token));
        vm.stopPrank();
    }

    function testStudentNeverDrainedCannotClaim() public {
        vm.prank(bob);
        vm.expectRevert(Drainer.NothingOwed.selector);
        round1.claimRefund(address(token));
    }

    function testRefundedStudentDrainedAgainIsOwedTheNewAmount() public {
        _fallForRound1(alice);
        vm.prank(alice);
        round1.claimRefund(address(token));

        // Allowance is still open, so a second sweep takes the refund straight back.
        round1.sweep(_one(alice), address(token));
        assertEq(round1.owedTo(alice), FAUCET, "second drain is owed, not lost");

        round1.refund(_one(alice), address(token));
        assertEq(token.balanceOf(alice), FAUCET);
        assertEq(round1.owedTo(alice), 0);
    }

    function testStudentRefundAndStaffRefundDoNotDoublePay() public {
        _fallForRound1(alice);
        _fallForRound1(bob);
        vm.prank(alice);
        round1.claimRefund(address(token));

        round1.refund(_two(alice, bob), address(token));

        assertEq(token.balanceOf(alice), FAUCET, "alice paid once");
        assertEq(token.balanceOf(bob), FAUCET);
        assertEq(token.balanceOf(address(round1)), 0, "drainer holds nothing extra");
    }

    function testRefundDoesNotUndoLabProgress() public {
        _complete(alice);
        vm.prank(alice);
        round1.claimRefund(address(token));
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
        round1.sweep(_one(alice), address(token));
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
        round1.claimRefund(address(token));
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
        round1.sweep(_one(alice), address(token));

        assertEq(round1.drainedAt(alice), first, "exposure is measured from the first drain");
        assertEq(round1.drainedAmount(alice), FAUCET * 2);
    }

    function testOnlyOperatorCanSweep() public {
        vm.prank(alice);
        vm.expectRevert(Drainer.NotOperator.selector);
        round1.sweep(_one(alice), address(token));
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

    // --- round 2: proving an absence --------------------------------------------------

    function testRound2CannotStartBeforeRecovery() public {
        _fallForRound1(alice);
        vm.prank(alice);
        vm.expectRevert(ApprovalLab.RecoveryNotDone.selector);
        lab.enterRound2();
    }

    function testIncompleteWithoutEnteringRound2() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        _sweepRound2(alice);
        assertFalse(lab.hasCompleted(alice));
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
        round2.sweep(_one(bob), address(token));
        _enterRound2(alice);

        assertFalse(lab.progressOf(alice).round2Tested);
        assertFalse(lab.hasCompleted(alice));
    }

    function testSameBlockSweepDoesNotCount() public {
        _fallForRound1(alice);
        _revokeAndRecover(alice);
        _enterRound2(alice);
        round2.sweep(_one(alice), address(token)); // same block as entering

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
        _enterRound2(alice);
        token.mint(alice, FAUCET);
        _sweepRound2(alice);

        ApprovalLab.Progress memory p = lab.progressOf(alice);
        assertTrue(p.drained && p.revoked && p.round2Tested && p.round2Passed);
        assertTrue(lab.hasCompleted(alice));
        assertEq(p.secondsExposed, 45);
        assertEq(token.balanceOf(alice), FAUCET, "round 2 took nothing");
    }

    function testReenteringRound2RequiresFreshAttempt() public {
        _complete(alice);
        assertTrue(lab.hasCompleted(alice));

        _enterRound2(alice);
        assertFalse(lab.hasCompleted(alice), "old sweep cannot vouch for the new attempt");

        _sweepRound2(alice);
        assertTrue(lab.hasCompleted(alice));
    }

    // --- completion ------------------------------------------------------------------

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
