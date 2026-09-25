// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Drainer} from "../src/Drainer.sol";
import {FakeAirdrop} from "../src/FakeAirdrop.sol";
import {SurvivorBadge} from "../src/SurvivorBadge.sol";

/// Staff lever for the Approval & Drain Lab. Targets every Student who clicked Claim.
///
///   ROUND=1                sweep round 1 (the drain)
///   ROUND=2                optional legacy second-drain exercise
///   ACTION=refund ROUND=n  return what that round took
///   ACTION=shutdown ROUND=n retire that drainer for good; refunds keep working
///   ACTION=reward          send 500 FINS + survivor NFT to every eligible claimant
contract SweepApprovalLab is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    function run() external {
        require(block.chainid == SEPOLIA_CHAIN_ID, "Sepolia only");

        uint256 round = vm.envOr("ROUND", uint256(1));
        string memory action = vm.envOr("ACTION", string("sweep"));
        uint256 operatorKey = vm.envUint("LAB_OPERATOR_PRIVATE_KEY");

        string memory path = string.concat("./deployments/approval-lab-", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);

        FakeAirdrop airdrop = FakeAirdrop(vm.parseJsonAddress(json, ".fakeAirdrop"));
        Drainer finsDrainer =
            Drainer(payable(vm.parseJsonAddress(json, round == 2 ? ".drainerRound2" : ".drainerRound1")));
        Drainer audDrainer =
            Drainer(payable(vm.parseJsonAddress(json, round == 2 ? ".audDrainerRound2" : ".audDrainerRound1")));

        if (keccak256(bytes(action)) == keccak256("shutdown")) {
            vm.startBroadcast(operatorKey);
            finsDrainer.shutdown();
            audDrainer.shutdown();
            vm.stopBroadcast();
            console2.log("shut down drainer for round", round);
            return;
        }

        address[] memory victims = airdrop.claimants();
        if (victims.length == 0) {
            console2.log("No claim attempts recorded yet; nothing to do.");
            return;
        }

        if (keccak256(bytes(action)) == keccak256("reward")) {
            SurvivorBadge badge = SurvivorBadge(vm.parseJsonAddress(json, ".survivorBadge"));
            vm.startBroadcast(operatorKey);
            uint256 awarded = badge.airdrop(victims);
            vm.stopBroadcast();
            console2.log("completion rewards sent", awarded);
            return;
        }

        vm.startBroadcast(operatorKey);
        if (keccak256(bytes(action)) == keccak256("refund")) {
            finsDrainer.refund(victims);
            audDrainer.refund(victims);
        } else {
            finsDrainer.sweep(victims);
            audDrainer.sweep(victims);
        }
        vm.stopBroadcast();

        uint256 finsDrained;
        uint256 audDrained;
        for (uint256 i = 0; i < victims.length; i++) {
            if (finsDrainer.hasDrained(victims[i])) finsDrained++;
            if (audDrainer.hasDrained(victims[i])) audDrained++;
        }
        console2.log("round", round);
        console2.log("targets", victims.length);
        console2.log("FINS drained by this round (all time)", finsDrained);
        console2.log("AUD drained by this round (all time)", audDrained);
    }
}
