// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FINSToken} from "../src/FINSToken.sol";
import {Drainer} from "../src/Drainer.sol";
import {FakeAirdrop} from "../src/FakeAirdrop.sol";
import {ApprovalLab} from "../src/ApprovalLab.sol";
import {SurvivorBadge} from "../src/SurvivorBadge.sol";

/// Deploys the Approval & Drain Lab stack to Sepolia and writes deployments/<chainId>.json.
/// SEPOLIA_DEPLOYER_PRIVATE_KEY is used only by Foundry and must never enter the web app.
contract DeployApprovalLab is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    address internal constant COURSE_AUD = 0x3676b864a37b31dfe6372384de7d02d27F6FF4e4;

    function run() external {
        require(block.chainid == SEPOLIA_CHAIN_ID, "Sepolia only");

        uint256 deployerKey = vm.envUint("SEPOLIA_DEPLOYER_PRIVATE_KEY");
        address operator = vm.envAddress("LAB_OPERATOR_ADDRESS");
        require(operator != address(0), "operator is zero");
        require(COURSE_AUD.code.length != 0, "course AUD is not deployed on Sepolia");
        vm.startBroadcast(deployerKey);

        FINSToken token = new FINSToken(operator);
        Drainer round1 = new Drainer(operator, address(token), address(0), "round-1: FINS Student Genesis Drop");
        Drainer round2 = new Drainer(operator, address(token), address(0), "round-2: Sentrywell");
        Drainer audRound1 = new Drainer(operator, COURSE_AUD, address(0), "round-1: course AUD");
        Drainer audRound2 = new Drainer(operator, COURSE_AUD, address(0), "round-2: course AUD");
        FakeAirdrop airdrop = new FakeAirdrop(address(token), address(round1));
        ApprovalLab lab = new ApprovalLab(
            operator,
            address(token),
            COURSE_AUD,
            address(round1),
            address(round2),
            address(audRound1),
            address(audRound2)
        );
        // The reward is its own dapp: the badge contract reads the lab's completion and is the
        // sole FINS completion minter.
        SurvivorBadge badge = new SurvivorBadge(operator, address(token), address(lab));
        token.configureCompletionMinter(address(badge));

        vm.stopBroadcast();

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "operator", operator);
        vm.serializeAddress(key, "finsToken", address(token));
        vm.serializeAddress(key, "audToken", COURSE_AUD);
        vm.serializeAddress(key, "drainerRound1", address(round1));
        vm.serializeAddress(key, "drainerRound2", address(round2));
        vm.serializeAddress(key, "audDrainerRound1", address(audRound1));
        vm.serializeAddress(key, "audDrainerRound2", address(audRound2));
        vm.serializeAddress(key, "fakeAirdrop", address(airdrop));
        vm.serializeAddress(key, "approvalLab", address(lab));
        string memory json = vm.serializeAddress(key, "survivorBadge", address(badge));

        string memory path = string.concat("./deployments/approval-lab-", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("FINS token   ", address(token));
        console2.log("Drainer r1   ", address(round1));
        console2.log("Drainer r2   ", address(round2));
        console2.log("Course AUD    ", COURSE_AUD);
        console2.log("AUD drainer r1", address(audRound1));
        console2.log("AUD drainer r2", address(audRound2));
        console2.log("FakeAirdrop  ", address(airdrop));
        console2.log("ApprovalLab  ", address(lab));
        console2.log("SurvivorBadge", address(badge));
        console2.log("wrote", path);
    }
}
