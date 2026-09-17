// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title FakeAirdrop
 * @notice The "claim" button on the round-1 lure. It records that you turned up, and
 *         sends nothing. Ever.
 *
 * The theft does not happen here. It happens later in `Drainer`, using the allowance the
 * lure talked the Student into signing on the way in.
 *
 * Ethics: the campaign name is invented and impersonates no real protocol, token or brand.
 * The wallet prompt stays honest; only the page lies.
 */
contract FakeAirdrop {
    address public immutable spender;
    address public immutable token;

    string public constant CAMPAIGN = "Brightfold Rewards Season 1";
    uint256 public constant PROMISED_AMOUNT = 5_000e18;

    mapping(address => uint64) public claimAttemptedAt;

    /// @dev Kept on-chain so the staff sweep script can target exactly the Students who
    ///      clicked Claim, and nobody else.
    address[] private _claimants;

    event ClaimAttempted(address indexed student, uint64 timestamp, uint256 promisedAmount);

    constructor(address token_, address spender_) {
        token = token_;
        spender = spender_;
    }

    function claim() external {
        if (claimAttemptedAt[msg.sender] == 0) {
            claimAttemptedAt[msg.sender] = uint64(block.timestamp);
            _claimants.push(msg.sender);
        }
        emit ClaimAttempted(msg.sender, uint64(block.timestamp), PROMISED_AMOUNT);
    }

    function hasAttempted(address student) external view returns (bool) {
        return claimAttemptedAt[student] != 0;
    }

    function claimants() external view returns (address[] memory) {
        return _claimants;
    }

    function totalAttempts() external view returns (uint256) {
        return _claimants.length;
    }
}
