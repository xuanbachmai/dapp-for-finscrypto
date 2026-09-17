// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LabAUD} from "../src/LabAUD.sol";
import {Drainer} from "../src/Drainer.sol";
import {FakeAirdrop} from "../src/FakeAirdrop.sol";
import {ApprovalLab} from "../src/ApprovalLab.sol";

/// Deploys the Approval & Drain Lab stack and writes deployments/<chainId>.json.
/// The broadcaster becomes the operator. On a shared Chain that should be a Safe.
contract DeployApprovalLab is Script {
    function run() external {
        vm.startBroadcast();
        address operator = msg.sender;

        LabAUD token = new LabAUD(operator);
        Drainer round1 = new Drainer(operator, address(0), "round-1: Brightfold Rewards");
        Drainer round2 = new Drainer(operator, address(0), "round-2: Sentrywell");
        FakeAirdrop airdrop = new FakeAirdrop(address(token), address(round1));
        ApprovalLab lab = new ApprovalLab(operator, address(token), address(round1), address(round2));

        vm.stopBroadcast();

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "operator", operator);
        vm.serializeAddress(key, "labAud", address(token));
        vm.serializeAddress(key, "drainerRound1", address(round1));
        vm.serializeAddress(key, "drainerRound2", address(round2));
        vm.serializeAddress(key, "fakeAirdrop", address(airdrop));
        string memory json = vm.serializeAddress(key, "approvalLab", address(lab));

        string memory path = string.concat("./deployments/approval-lab-", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("LabAUD       ", address(token));
        console2.log("Drainer r1   ", address(round1));
        console2.log("Drainer r2   ", address(round2));
        console2.log("FakeAirdrop  ", address(airdrop));
        console2.log("ApprovalLab  ", address(lab));
        console2.log("wrote", path);
    }
}
