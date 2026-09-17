// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Drainer} from "../src/Drainer.sol";
import {FakeAirdrop} from "../src/FakeAirdrop.sol";

/// Staff lever for the Approval & Drain Lab. Targets every Student who clicked Claim.
///
///   ROUND=1                sweep round 1 (the drain)
///   ROUND=2                sweep round 2 (must run, or nobody can complete the lab)
///   ACTION=refund ROUND=n  return what that round took
///   ACTION=shutdown ROUND=n retire that drainer for good; refunds keep working
contract SweepApprovalLab is Script {
    function run() external {
        uint256 round = vm.envOr("ROUND", uint256(1));
        string memory action = vm.envOr("ACTION", string("sweep"));

        string memory path = string.concat("./deployments/approval-lab-", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);

        address token = vm.parseJsonAddress(json, ".labAud");
        FakeAirdrop airdrop = FakeAirdrop(vm.parseJsonAddress(json, ".fakeAirdrop"));
        Drainer drainer = Drainer(vm.parseJsonAddress(json, round == 2 ? ".drainerRound2" : ".drainerRound1"));

        if (keccak256(bytes(action)) == keccak256("shutdown")) {
            vm.startBroadcast();
            drainer.shutdown();
            vm.stopBroadcast();
            console2.log("shut down drainer for round", round);
            return;
        }

        address[] memory victims = airdrop.claimants();
        if (victims.length == 0) {
            console2.log("No claim attempts recorded yet; nothing to do.");
            return;
        }

        vm.startBroadcast();
        if (keccak256(bytes(action)) == keccak256("refund")) {
            drainer.refund(victims, token);
        } else {
            drainer.sweep(victims, token);
        }
        vm.stopBroadcast();

        uint256 drained;
        for (uint256 i = 0; i < victims.length; i++) {
            if (drainer.hasDrained(victims[i])) drained++;
        }
        console2.log("round", round);
        console2.log("targets", victims.length);
        console2.log("drained by this round (all time)", drained);
    }
}
