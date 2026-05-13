// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICharityPlatform {
    function donate(uint _campaignId) external payable;
    function claimRefund(uint _campaignId) external;
}

/**
 * @title MaliciousRefundReceiver
 * @notice Test-only contract that attempts a re-entrancy attack against
 *         CharityPlatform.claimRefund. The receive() function calls
 *         claimRefund a second time during the first refund's transfer.
 *         If the ReentrancyGuard is correctly applied, the second call
 *         must revert with "Reentrant call".
 *
 *         This contract is used only by the adversarial Truffle tests in
 *         blockchain/test/adversarial.test.js and is NOT deployed to any
 *         public network.
 */
contract MaliciousRefundReceiver {
    ICharityPlatform public target;
    uint256 public reentryAttempts;
    uint256 public reentryReverts;
    uint256 public campaignId;
    bool public attackEnabled;

    constructor(address _target) {
        target = ICharityPlatform(_target);
    }

    function setCampaign(uint256 _id) external {
        campaignId = _id;
    }

    function arm() external {
        attackEnabled = true;
    }

    function disarm() external {
        attackEnabled = false;
    }

    /// @notice Donate from this contract so it shows up as a donor.
    function donateAs(uint256 _id) external payable {
        target.donate{value: msg.value}(_id);
    }

    /// @notice Trigger the legitimate refund claim. The follow-up
    ///         re-entrancy attempt happens inside receive().
    function attack() external {
        target.claimRefund(campaignId);
    }

    receive() external payable {
        if (!attackEnabled) return;
        reentryAttempts += 1;
        // Try to re-enter claimRefund. Must revert under ReentrancyGuard.
        try target.claimRefund(campaignId) {
            // unreachable if guard works
        } catch {
            reentryReverts += 1;
        }
    }
}
