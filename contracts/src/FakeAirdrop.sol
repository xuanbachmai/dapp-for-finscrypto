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
 * Ethics: the student allocation and exchange-listing promise are fictional teaching
 * pretexts for a supervised course exercise. The wallet prompt stays honest; only the
 * page around it lies.
 */
contract FakeAirdrop {
    address public immutable spender;
    address public immutable token;

    string public constant CAMPAIGN = "FINS3647/FINS5547 Student Genesis Allocation";
    uint256 public constant PROMISED_AMOUNT = 500e18;

    mapping(address => uint64) public claimAttemptedAt;

    /// @dev Kept on-chain so the staff sweep script can target exactly the Students who
    ///      clicked Claim, and nobody else.
    address[] private _claimants;

    event ClaimAttempted(address indexed student, uint64 timestamp, uint256 promisedAmount);

    error ZeroAddress();

    constructor(address token_, address spender_) {
        if (token_ == address(0) || spender_ == address(0)) revert ZeroAddress();
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
