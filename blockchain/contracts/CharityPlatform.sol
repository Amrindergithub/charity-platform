// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title CharityPlatform
 * @notice Decentralised charity donation platform with DAO governance
 * @dev Supports native ETH + ERC-20 stablecoin (USDT/USDC/DAI) donations
 *      Designed for Polygon deployment (~$0.01 gas fees)
 *      Ganache-compatible for local development
 *
 * Security fixes applied (Phase 1):
 *   1. Checks-Effects-Interactions pattern in _executeRequest (reentrancy)
 *   2. Cancelled campaign guard on approveRequest
 *   3. Per-campaign balance check (no cross-campaign fund pool)
 *   4. Stablecoin minimum contribution enforcement
 *   5. Campaign existence validation on donate
 *   6. Proportional refunds accounting for disbursed funds
 *   7. Manager cannot vote on own requests
 *   8. Cancelled campaign guard on _executeRequest
 *   9. Input validation on createCampaign and createRequest
 *  10. Stablecoin transfer return value checked
 *  11. Event for setStablecoinAddress
 *
 * Advanced features (Phase 8):
 *  12. Automated Phased Milestones — campaigns define phases with vendor
 *      addresses; donate() auto-creates voting requests when thresholds are met
 *  13. Hybrid Auto-Refunds — cancelCampaign() pushes refunds to all donors
 *      automatically; claimRefund() remains as a manual fallback for any
 *      failed transfers (safe against gas-limit DoS and griefing)
 *
 * Security hardening (Phase 9):
 *  14. Inline ReentrancyGuard on all outbound-transfer functions
 *  15. Whale donation fix — while loop triggers multiple phases per donation
 *      (capped at 5 per tx for gas safety)
 *  16. Auto-refund batch capped at 20 donors per cancelCampaign call
 *      (continueRefunds handles the rest)
 *
 * Security hardening (Phase 10):
 *  17. Double-dip refund bug fix — track ETH and stablecoin refunds separately
 *  18. Bounds checks on all campaign/request functions
 *  19. Batch size cap on continueRefunds
 *  20. Stablecoin donations trigger phase milestones via _totalRaised()
 *  21. Manager donations do not inflate voter count
 *  22. Deadline checks on createRequest and approveRequest
 *  23. Locked pragma to 0.8.28
 *  24. Indexed event parameters for efficient filtering
 *  25. receive() revert to prevent accidental ETH sends
 *  26. Renamed _min to _minimumContribution for clarity
 *
 * Decentralised Identity (Phase 12):
 *  27. On-chain DonorIdentity struct tracks campaigns backed, ETH donated,
 *      votes cast per wallet address
 *  28. Reputation score algorithm (weighted: campaigns*10, 0.1ETH*5, votes*3)
 *  29. Reputation tiers: Unranked > Observer > Contributor > Guardian > Champion > Legend
 *  30. getDonorIdentity() and getReputationTier() view functions
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract CharityPlatform {

    // ══════════════════════════════════════════════
    //  DATA STRUCTURES
    // ══════════════════════════════════════════════

    struct Phase {
        string description;      // what this phase funds (e.g. "Foundation & groundwork")
        uint targetAmount;       // cumulative ETH target (ascending: 2e18, 5e18, 10e18)
        address payable vendor;  // who receives the funds for this phase
        bool requestCreated;     // true once auto-request has been created
        uint requestId;          // the linked Request index
    }

    struct Request {
        string description;
        uint value;
        address payable recipient;
        bool complete;
        uint approvalCount;
        string category;
        bool isStablecoin;
        mapping(address => bool) approvals;
    }

    struct Campaign {
        address manager;
        uint minimumContribution;
        string name;
        string description;
        uint campaignId;
        uint target;
        uint raisedAmount;
        uint stablecoinRaised;
        uint approversCount;
        mapping(address => bool) approvers;
        uint numRequests;
        uint totalDisbursed;
        uint stablecoinDisbursed;
        uint deadline;
        bool cancelled;
        uint currentPhase;       // index of the next phase to trigger
    }

    // ══════════════════════════════════════════════
    //  DECENTRALISED IDENTITY (On-Chain Reputation)
    // ══════════════════════════════════════════════

    struct DonorIdentity {
        uint totalCampaignsBacked;
        uint totalEthDonated;
        uint totalStablecoinDonated;
        uint totalVotesCast;
        uint firstActivityTimestamp;
        bool exists;
    }

    // ══════════════════════════════════════════════
    //  STATE VARIABLES
    // ══════════════════════════════════════════════

    uint public campaignCount;
    mapping(uint => Campaign) public campaigns;
    mapping(uint => mapping(uint => Request)) public requests;

    // Phases per campaign
    mapping(uint => Phase[]) public campaignPhases;

    // Donor tracking
    mapping(uint => mapping(address => uint)) public donorContributions;
    mapping(uint => mapping(address => uint)) public donorStablecoinContributions;
    mapping(uint => address[]) public campaignDonors;

    // Auto-refund tracking
    mapping(uint => mapping(address => bool)) public refundProcessed;

    // Decentralised Identity — on-chain reputation per wallet
    mapping(address => DonorIdentity) public donorIdentities;

    // Platform-wide counters
    uint public totalDonationsAllTime;
    uint public totalStablecoinDonationsAllTime;
    uint public totalCampaignsCreated;
    uint public totalRequestsFinalized;

    address public stablecoinAddress;
    address public owner;

    // Issue 14: Inline ReentrancyGuard
    uint256 private _locked = 1;

    // Issue 16: Max donors to auto-refund in cancelCampaign
    uint public constant MAX_AUTO_REFUND_BATCH = 20;

    // Issue 15: Max phases to trigger per donation
    uint public constant MAX_PHASES_PER_DONATION = 5;

    // ══════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════

    event CampaignCreated(uint256 indexed campaignId, string name, address indexed manager, uint target, uint deadline);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint amount, bool isStablecoin, uint newTotal);
    event RequestCreated(uint256 indexed campaignId, uint256 requestId, string description, uint value, string category);
    event RequestApproved(uint256 indexed campaignId, uint256 requestId, address indexed approver, uint approvalCount);
    event RequestFinalized(uint256 indexed campaignId, uint256 requestId, uint value, address indexed recipient);
    event CampaignCancelled(uint256 indexed campaignId);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint ethAmount, uint stablecoinAmount);
    event StablecoinAddressUpdated(address indexed oldAddress, address indexed newAddress);

    // Phase 8 events
    event PhaseTriggered(uint256 indexed campaignId, uint phaseIndex, uint requestId, string description);
    event AutoRefundSent(uint256 indexed campaignId, address indexed donor, uint ethAmount, uint stablecoinAmount);
    event AutoRefundFailed(uint256 indexed campaignId, address indexed donor);

    // Phase 10: Partial refund event
    event PartialRefundSent(uint256 indexed campaignId, address indexed donor, uint ethAmount, uint stablecoinAmount, bool ethSuccess, bool stablecoinSuccess);

    // Phase 12: Decentralised Identity
    event IdentityUpdated(address indexed wallet, uint campaignsBacked, uint ethDonated, uint votesCast);

    // ══════════════════════════════════════════════
    //  CONSTRUCTOR & MODIFIERS
    // ══════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only platform owner");
        _;
    }

    /// @dev Issue 14: Inline reentrancy guard — prevents re-entering any
    ///      function marked nonReentrant while an external call is in flight.
    modifier nonReentrant() {
        require(_locked == 1, "ReentrancyGuard: reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // Issue 25: Reject accidental ETH sends — use donate() instead
    receive() external payable {
        revert("Use donate() to contribute");
    }

    // Issue 11: Validate address + emit event
    function setStablecoinAddress(address _token) public onlyOwner {
        require(_token != address(0), "Invalid token address");
        address old = stablecoinAddress;
        stablecoinAddress = _token;
        emit StablecoinAddressUpdated(old, _token);
    }

    // ══════════════════════════════════════════════
    //  CAMPAIGN MANAGEMENT
    // ══════════════════════════════════════════════

    /// @notice Create a campaign, optionally with phased milestones
    /// @param _phaseDescs   Description per phase (empty array = no phases)
    /// @param _phaseTargets Cumulative ETH targets in ascending order
    /// @param _phaseVendors Vendor wallet per phase
    function createCampaign(
        string memory _name,
        string memory _desc,
        uint _target,
        uint _minimumContribution,
        uint _deadlineDays,
        string[] memory _phaseDescs,
        uint[] memory _phaseTargets,
        address payable[] memory _phaseVendors
    ) public {
        require(bytes(_name).length > 0, "Name required");
        require(_target > 0, "Target must be > 0");
        require(_minimumContribution > 0, "Minimum contribution must be > 0");
        require(_phaseDescs.length == _phaseTargets.length, "Phase arrays length mismatch");
        require(_phaseTargets.length == _phaseVendors.length, "Phase arrays length mismatch");

        Campaign storage c = campaigns[campaignCount];
        c.campaignId = campaignCount;
        c.manager = msg.sender;
        c.name = _name;
        c.description = _desc;
        c.target = _target;
        c.minimumContribution = _minimumContribution;
        c.deadline = _deadlineDays > 0 ? block.timestamp + (_deadlineDays * 1 days) : 0;
        c.currentPhase = 0;

        // Validate and store phases
        for (uint i = 0; i < _phaseDescs.length; i++) {
            require(bytes(_phaseDescs[i]).length > 0, "Phase description required");
            require(_phaseTargets[i] > 0, "Phase target must be > 0");
            require(_phaseVendors[i] != address(0), "Invalid vendor address");
            if (i > 0) {
                require(_phaseTargets[i] > _phaseTargets[i - 1], "Phase targets must be ascending");
            }
            campaignPhases[campaignCount].push(Phase({
                description: _phaseDescs[i],
                targetAmount: _phaseTargets[i],
                vendor: _phaseVendors[i],
                requestCreated: false,
                requestId: 0
            }));
        }

        // If phases exist, the final phase target must equal the campaign target
        if (_phaseTargets.length > 0) {
            require(
                _phaseTargets[_phaseTargets.length - 1] == _target,
                "Final phase target must equal campaign target"
            );
        }

        emit CampaignCreated(campaignCount, _name, msg.sender, _target, c.deadline);
        totalCampaignsCreated++;
        campaignCount++;
    }

    // ══════════════════════════════════════════════
    //  DONATIONS
    // ══════════════════════════════════════════════

    /// @notice Donate ETH — auto-triggers phase milestone(s) if threshold is met
    function donate(uint _campaignId) public payable {
        require(_campaignId < campaignCount, "Campaign does not exist");
        Campaign storage c = campaigns[_campaignId];
        require(!c.cancelled, "Campaign cancelled");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "Campaign deadline passed");
        require(msg.value >= c.minimumContribution, "Donation below minimum");
        // Issue 21: Reject donations once funding goal is reached
        require(c.raisedAmount < c.target, "Goal already reached");

        _registerDonor(_campaignId);
        c.raisedAmount += msg.value;
        donorContributions[_campaignId][msg.sender] += msg.value;
        totalDonationsAllTime += msg.value;

        // Update decentralised identity
        _updateDonorIdentity(msg.sender, _campaignId, msg.value, 0, false);

        emit DonationReceived(_campaignId, msg.sender, msg.value, false, c.raisedAmount);

        // Issue 15: Check if this donation crosses phase threshold(s)
        _checkPhaseThreshold(_campaignId);
    }

    /// @notice Donate ERC-20 stablecoin
    function donateStablecoin(uint _campaignId, uint _amount) public {
        require(_campaignId < campaignCount, "Campaign does not exist");
        require(stablecoinAddress != address(0), "Stablecoin not configured");
        Campaign storage c = campaigns[_campaignId];
        require(!c.cancelled, "Campaign cancelled");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "Deadline passed");
        // Issue 21: Reject donations once ETH-denominated goal is reached
        // (Stablecoin contributions tracked separately; this guards against runaway donations
        //  on a campaign that has already met its target in ETH alone.)
        require(c.raisedAmount < c.target, "Goal already reached");
        // minimumContribution is in wei (ETH); stablecoins use different decimals (e.g. 6 for USDT)
        // so we only enforce a non-zero check here
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 token = IERC20(stablecoinAddress);
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        _registerDonor(_campaignId);
        c.stablecoinRaised += _amount;
        donorStablecoinContributions[_campaignId][msg.sender] += _amount;
        totalStablecoinDonationsAllTime += _amount;

        // Update decentralised identity
        _updateDonorIdentity(msg.sender, _campaignId, 0, _amount, false);

        emit DonationReceived(_campaignId, msg.sender, _amount, true, c.stablecoinRaised);

        // Issue 20: Stablecoin donations should also trigger phase milestones
        _checkPhaseThreshold(_campaignId);
    }

    function _registerDonor(uint _campaignId) internal {
        Campaign storage c = campaigns[_campaignId];
        // Issue 21: Manager can donate but should not inflate voter count
        if (!c.approvers[msg.sender] && msg.sender != c.manager) {
            c.approvers[msg.sender] = true;
            c.approversCount++;
            campaignDonors[_campaignId].push(msg.sender);
        }
    }

    // ══════════════════════════════════════════════
    //  PHASED MILESTONES
    // ══════════════════════════════════════════════

    /// @dev Issue 20: Helper to compute total raised (ETH + stablecoin)
    function _totalRaised(uint _campaignId) internal view returns (uint) {
        Campaign storage c = campaigns[_campaignId];
        return c.raisedAmount + c.stablecoinRaised;
    }

    /// @dev Issue 15: Called after every donation — uses a WHILE loop so a
    ///      single large ("whale") donation can trigger multiple phases at once.
    ///      Capped at MAX_PHASES_PER_DONATION (5) per call for gas safety.
    ///      Issue 20: Now compares against _totalRaised (ETH + stablecoin).
    function _checkPhaseThreshold(uint _campaignId) internal {
        Campaign storage c = campaigns[_campaignId];
        Phase[] storage phases = campaignPhases[_campaignId];

        // No phases configured, or all phases already triggered
        if (phases.length == 0 || c.currentPhase >= phases.length) return;

        uint triggered = 0;
        uint totalRaisedAmount = _totalRaised(_campaignId);

        // Issue 15: while loop — one whale donation can trigger multiple phases
        while (
            c.currentPhase < phases.length &&
            triggered < MAX_PHASES_PER_DONATION
        ) {
            Phase storage active = phases[c.currentPhase];

            // Has the total raised amount crossed this phase's cumulative target?
            if (totalRaisedAmount < active.targetAmount || active.requestCreated) break;

            // Calculate the ETH value for THIS phase (incremental, not cumulative)
            uint value = active.targetAmount;
            if (c.currentPhase > 0) {
                value = active.targetAmount - phases[c.currentPhase - 1].targetAmount;
            }

            // Auto-create a spending request linked to this phase
            Request storage r = requests[_campaignId][c.numRequests];
            r.description = active.description;
            r.value = value;
            r.recipient = active.vendor;
            r.category = "Phase Milestone";
            r.isStablecoin = false;

            active.requestCreated = true;
            active.requestId = c.numRequests;

            emit RequestCreated(_campaignId, c.numRequests, active.description, value, "Phase Milestone");
            emit PhaseTriggered(_campaignId, c.currentPhase, c.numRequests, active.description);

            c.numRequests++;
            c.currentPhase++;
            triggered++;
        }
    }

    // ══════════════════════════════════════════════
    //  SPENDING REQUESTS (DAO GOVERNANCE)
    // ══════════════════════════════════════════════

    /// @notice Manager creates a manual spending request (non-phase)
    function createRequest(
        uint _campaignId,
        string memory _description,
        uint _value,
        address payable _recipient,
        string memory _category,
        bool _isStablecoin
    ) public {
        require(_campaignId < campaignCount, "Campaign does not exist");
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.manager, "Only manager");
        require(!c.cancelled, "Campaign cancelled");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "Campaign expired");
        require(bytes(_description).length > 0, "Description required");
        require(_value > 0, "Value must be > 0");
        require(_recipient != address(0), "Invalid recipient address");

        Request storage r = requests[_campaignId][c.numRequests];
        r.description = _description;
        r.value = _value;
        r.recipient = _recipient;
        r.category = _category;
        r.isStablecoin = _isStablecoin;

        emit RequestCreated(_campaignId, c.numRequests, _description, _value, _category);
        c.numRequests++;
    }

    /// @notice Donor votes to approve a spending request
    /// @dev Issue 14: nonReentrant — auto-release calls _executeRequest which
    ///      performs external ETH transfers
    function approveRequest(uint _campaignId, uint _requestId) public nonReentrant {
        require(_campaignId < campaignCount, "Campaign does not exist");
        Campaign storage c = campaigns[_campaignId];
        require(_requestId < c.numRequests, "Request does not exist");
        Request storage r = requests[_campaignId][_requestId];

        require(!c.cancelled, "Campaign cancelled");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "Campaign expired");
        require(msg.sender != c.manager, "Manager cannot vote on own requests");
        require(c.approvers[msg.sender], "Only donors can vote");
        require(!r.approvals[msg.sender], "Already voted");
        require(!r.complete, "Already finalised");

        r.approvals[msg.sender] = true;
        r.approvalCount++;

        // Update decentralised identity — vote cast
        _updateDonorIdentity(msg.sender, 0, 0, 0, true);

        emit RequestApproved(_campaignId, _requestId, msg.sender, r.approvalCount);

        // Auto-release: if this vote tips over 50%, execute immediately
        if (r.approvalCount > (c.approversCount / 2)) {
            _executeRequest(_campaignId, _requestId);
        }
    }

    /// @notice Manager fallback to manually release approved funds
    /// @dev Issue 14: nonReentrant — calls _executeRequest with external transfers
    function finalizeRequest(uint _campaignId, uint _requestId) public nonReentrant {
        require(_campaignId < campaignCount, "Campaign does not exist");
        Campaign storage c = campaigns[_campaignId];
        require(_requestId < c.numRequests, "Request does not exist");
        require(msg.sender == c.manager, "Only manager");
        require(!c.cancelled, "Campaign cancelled");
        require(!requests[_campaignId][_requestId].complete, "Already complete");
        require(requests[_campaignId][_requestId].approvalCount > (c.approversCount / 2), "Not enough approvals");

        _executeRequest(_campaignId, _requestId);
    }

    /// @dev Internal: transfers funds to recipient and marks request complete
    ///      Follows Checks-Effects-Interactions pattern (state BEFORE transfers)
    function _executeRequest(uint _campaignId, uint _requestId) internal {
        Campaign storage c = campaigns[_campaignId];
        Request storage r = requests[_campaignId][_requestId];

        require(!c.cancelled, "Campaign cancelled");
        require(!r.complete, "Already executed");

        // ── EFFECTS first (state changes before external calls) ──
        r.complete = true;
        totalRequestsFinalized++;

        if (r.isStablecoin) {
            require(c.stablecoinRaised - c.stablecoinDisbursed >= r.value, "Insufficient stablecoin funds");
            c.stablecoinDisbursed += r.value;

            // ── INTERACTION last ──
            IERC20 token = IERC20(stablecoinAddress);
            require(token.transfer(r.recipient, r.value), "Stablecoin transfer failed");
        } else {
            require(c.raisedAmount - c.totalDisbursed >= r.value, "Insufficient campaign funds");
            c.totalDisbursed += r.value;

            // ── INTERACTION last (using call for gas flexibility) ──
            (bool sent, ) = r.recipient.call{value: r.value}("");
            require(sent, "ETH transfer failed");
        }

        emit RequestFinalized(_campaignId, _requestId, r.value, r.recipient);
    }

    // ══════════════════════════════════════════════
    //  REFUND MECHANISM (Hybrid Push + Pull)
    // ══════════════════════════════════════════════

    /// @notice Cancel campaign and automatically refund donors (batch capped)
    /// @dev Issue 14: nonReentrant — performs ETH transfers in batch
    ///      Issue 16: Batch capped at MAX_AUTO_REFUND_BATCH (20) donors.
    ///      If more donors exist, call continueRefunds() for remaining.
    function cancelCampaign(uint _campaignId) public nonReentrant {
        require(_campaignId < campaignCount, "Campaign does not exist");
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.manager, "Only manager");
        require(!c.cancelled, "Already cancelled");
        c.cancelled = true;
        emit CampaignCancelled(_campaignId);

        // Issue 16: Auto-refund first batch (capped at 20)
        uint donorCount = campaignDonors[_campaignId].length;
        uint batchSize = donorCount > MAX_AUTO_REFUND_BATCH ? MAX_AUTO_REFUND_BATCH : donorCount;
        if (batchSize > 0) {
            _processRefundBatch(_campaignId, 0, batchSize);
        }
    }

    /// @notice Continue auto-refunds for large campaigns (>20 donors)
    ///         Anyone can call this to process remaining donors in batches
    /// @dev Issue 14: nonReentrant — performs ETH transfers in batch
    function continueRefunds(uint _campaignId, uint _startIndex, uint _batchSize) public nonReentrant {
        require(_campaignId < campaignCount, "Campaign does not exist");
        require(campaigns[_campaignId].cancelled, "Not cancelled");
        require(_batchSize > 0, "Batch size must be > 0");
        require(_batchSize <= MAX_AUTO_REFUND_BATCH, "Batch size too large");
        _processRefundBatch(_campaignId, _startIndex, _batchSize);
    }

    /// @dev Issue 17: Process a batch of donor refunds with separate ETH/stablecoin
    ///      tracking. Safe against:
    ///      - Gas limit DoS (bounded batch size)
    ///      - Griefing (failed transfer doesn't block others)
    ///      - Reentrancy (contributions zeroed before transfer, restored per-type on failure)
    ///      - Double-dip (ETH and stablecoin tracked independently)
    function _processRefundBatch(uint _campaignId, uint _start, uint _count) internal {
        Campaign storage c = campaigns[_campaignId];
        address[] storage donors = campaignDonors[_campaignId];
        uint end = _start + _count > donors.length ? donors.length : _start + _count;

        uint ethRemaining = c.raisedAmount - c.totalDisbursed;
        uint scRemaining = c.stablecoinRaised - c.stablecoinDisbursed;

        for (uint i = _start; i < end; i++) {
            address donor = donors[i];

            // Skip already-refunded donors
            if (refundProcessed[_campaignId][donor]) continue;

            uint ethContrib = donorContributions[_campaignId][donor];
            uint scContrib = donorStablecoinContributions[_campaignId][donor];

            if (ethContrib == 0 && scContrib == 0) continue;

            // Calculate proportional refund
            uint ethAmt = c.raisedAmount > 0
                ? (ethContrib * ethRemaining) / c.raisedAmount
                : 0;
            uint scAmt = c.stablecoinRaised > 0
                ? (scContrib * scRemaining) / c.stablecoinRaised
                : 0;

            // ── EFFECTS first (prevent reentrancy / double-dip) ──
            refundProcessed[_campaignId][donor] = true;
            donorContributions[_campaignId][donor] = 0;
            donorStablecoinContributions[_campaignId][donor] = 0;

            // ── INTERACTIONS — track each transfer independently ──
            bool ethSuccess = true;
            bool scSuccess = true;

            // Attempt ETH transfer
            if (ethAmt > 0) {
                (bool sent, ) = payable(donor).call{value: ethAmt}("");
                if (!sent) {
                    ethSuccess = false;
                    // Restore only ETH contribution so donor can claim manually
                    donorContributions[_campaignId][donor] = ethContrib;
                }
            }

            // Attempt stablecoin transfer separately
            if (scAmt > 0 && stablecoinAddress != address(0)) {
                try IERC20(stablecoinAddress).transfer(donor, scAmt) returns (bool ok) {
                    if (!ok) {
                        scSuccess = false;
                        donorStablecoinContributions[_campaignId][donor] = scContrib;
                    }
                } catch {
                    scSuccess = false;
                    donorStablecoinContributions[_campaignId][donor] = scContrib;
                }
            }

            if (ethSuccess && scSuccess) {
                emit AutoRefundSent(_campaignId, donor, ethAmt, scAmt);
            } else if (!ethSuccess && !scSuccess) {
                // Both failed — fully restore so donor can claim manually
                refundProcessed[_campaignId][donor] = false;
                emit AutoRefundFailed(_campaignId, donor);
            } else {
                // Partial success — keep refundProcessed true for the part that succeeded,
                // but mark as false so donor can retry the failed part via claimRefund
                refundProcessed[_campaignId][donor] = false;
                emit PartialRefundSent(
                    _campaignId, donor,
                    ethSuccess ? ethAmt : 0,
                    scSuccess ? scAmt : 0,
                    ethSuccess, scSuccess
                );
            }
        }
    }

    /// @notice Manual fallback: donor claims refund if auto-refund failed
    /// @dev Issue 14: nonReentrant — performs ETH/stablecoin transfer
    function claimRefund(uint _campaignId) public nonReentrant {
        require(_campaignId < campaignCount, "Campaign does not exist");
        Campaign storage c = campaigns[_campaignId];
        require(c.cancelled, "Campaign not cancelled");
        require(!refundProcessed[_campaignId][msg.sender], "Already refunded");

        uint ethContrib = donorContributions[_campaignId][msg.sender];
        uint scContrib = donorStablecoinContributions[_campaignId][msg.sender];
        require(ethContrib > 0 || scContrib > 0, "Nothing to refund");

        uint ethRemaining = c.raisedAmount - c.totalDisbursed;
        uint ethAmt = c.raisedAmount > 0 ? (ethContrib * ethRemaining) / c.raisedAmount : 0;

        uint scRemaining = c.stablecoinRaised - c.stablecoinDisbursed;
        uint scAmt = c.stablecoinRaised > 0 ? (scContrib * scRemaining) / c.stablecoinRaised : 0;

        // ── EFFECTS first ──
        refundProcessed[_campaignId][msg.sender] = true;
        donorContributions[_campaignId][msg.sender] = 0;
        donorStablecoinContributions[_campaignId][msg.sender] = 0;

        // ── INTERACTIONS last ──
        if (ethAmt > 0) {
            (bool sent, ) = payable(msg.sender).call{value: ethAmt}("");
            require(sent, "ETH refund failed");
        }
        if (scAmt > 0 && stablecoinAddress != address(0)) {
            require(IERC20(stablecoinAddress).transfer(msg.sender, scAmt), "Stablecoin refund failed");
        }

        emit RefundClaimed(_campaignId, msg.sender, ethAmt, scAmt);
    }

    // ══════════════════════════════════════════════
    //  DECENTRALISED IDENTITY HELPERS
    // ══════════════════════════════════════════════

    /// @dev Update the on-chain identity/reputation for a wallet
    function _updateDonorIdentity(
        address _wallet,
        uint _campaignId,
        uint _ethAmount,
        uint _scAmount,
        bool _isVote
    ) internal {
        DonorIdentity storage id = donorIdentities[_wallet];

        if (!id.exists) {
            id.exists = true;
            id.firstActivityTimestamp = block.timestamp;
        }

        if (_isVote) {
            id.totalVotesCast++;
        } else {
            // Check if first donation to this campaign:
            // After state update, if contribution equals amount just donated, it is the first
            if (donorContributions[_campaignId][_wallet] == _ethAmount &&
                donorStablecoinContributions[_campaignId][_wallet] == _scAmount) {
                id.totalCampaignsBacked++;
            }
            id.totalEthDonated += _ethAmount;
            id.totalStablecoinDonated += _scAmount;
        }

        emit IdentityUpdated(_wallet, id.totalCampaignsBacked, id.totalEthDonated, id.totalVotesCast);
    }

    // ══════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Core campaign info
    function getSummary(uint _id) public view returns (
        uint minContribution,
        uint raisedAmount,
        uint numRequests,
        uint approversCount,
        address manager,
        string memory name,
        uint target,
        uint totalDisbursed
    ) {
        Campaign storage c = campaigns[_id];
        return (c.minimumContribution, c.raisedAmount, c.numRequests,
                c.approversCount, c.manager, c.name, c.target, c.totalDisbursed);
    }

    /// @notice Extended campaign info (stablecoin, deadline, status)
    function getCampaignExtra(uint _id) public view returns (
        uint stablecoinRaised,
        uint stablecoinDisbursed,
        uint deadline,
        bool cancelled,
        string memory description
    ) {
        Campaign storage c = campaigns[_id];
        return (c.stablecoinRaised, c.stablecoinDisbursed, c.deadline, c.cancelled, c.description);
    }

    /// @notice Phase milestone info for a campaign
    function getPhaseCount(uint _campaignId) public view returns (uint) {
        return campaignPhases[_campaignId].length;
    }

    function getCurrentPhase(uint _campaignId) public view returns (uint) {
        return campaigns[_campaignId].currentPhase;
    }

    function getPhase(uint _campaignId, uint _phaseIndex) public view returns (
        string memory description,
        uint targetAmount,
        address vendor,
        bool requestCreated,
        uint requestId
    ) {
        Phase storage p = campaignPhases[_campaignId][_phaseIndex];
        return (p.description, p.targetAmount, p.vendor, p.requestCreated, p.requestId);
    }

    function getRequestDetails(uint _campaignId, uint _requestId) public view returns (
        string memory description,
        uint value,
        address recipient,
        bool complete,
        uint approvalCount,
        string memory category,
        bool isStablecoin
    ) {
        Request storage r = requests[_campaignId][_requestId];
        return (r.description, r.value, r.recipient, r.complete, r.approvalCount, r.category, r.isStablecoin);
    }

    function getRequestCount(uint _id) public view returns (uint) {
        return campaigns[_id].numRequests;
    }

    function isApprover(uint _id, address _addr) public view returns (bool) {
        return campaigns[_id].approvers[_addr];
    }

    function hasVoted(uint _id, uint _reqId, address _voter) public view returns (bool) {
        return requests[_id][_reqId].approvals[_voter];
    }

    function isRefunded(uint _campaignId, address _donor) public view returns (bool) {
        return refundProcessed[_campaignId][_donor];
    }

    function getDonorCount(uint _campaignId) public view returns (uint) {
        return campaignDonors[_campaignId].length;
    }

    function getPlatformStats() public view returns (
        uint _campaigns,
        uint _ethDonated,
        uint _scDonated,
        uint _finalized,
        uint _balance
    ) {
        return (totalCampaignsCreated, totalDonationsAllTime,
                totalStablecoinDonationsAllTime, totalRequestsFinalized, address(this).balance);
    }

    function getDonorContribution(uint _id, address _donor) public view returns (uint eth, uint sc) {
        return (donorContributions[_id][_donor], donorStablecoinContributions[_id][_donor]);
    }

    function isCampaignExpired(uint _id) public view returns (bool) {
        Campaign storage c = campaigns[_id];
        if (c.deadline == 0) return false;
        return block.timestamp > c.deadline;
    }

    /// @notice Get a wallet's decentralised identity / on-chain reputation
    function getDonorIdentity(address _donor) public view returns (
        uint campaignsBacked,
        uint ethDonated,
        uint stablecoinDonated,
        uint votesCast,
        uint firstActivity,
        uint reputationScore
    ) {
        DonorIdentity storage id = donorIdentities[_donor];

        // Reputation score: weighted formula
        // Each campaign backed = 10 points
        // Each 0.1 ETH donated = 5 points
        // Each vote cast = 3 points
        // Capped at 1000
        uint score = 0;
        if (id.exists) {
            score = (id.totalCampaignsBacked * 10) +
                    ((id.totalEthDonated / 1e17) * 5) +
                    (id.totalVotesCast * 3);
            if (score > 1000) score = 1000;
        }

        return (
            id.totalCampaignsBacked,
            id.totalEthDonated,
            id.totalStablecoinDonated,
            id.totalVotesCast,
            id.firstActivityTimestamp,
            score
        );
    }

    /// @notice Get reputation tier label
    /// @return tier 0=Unranked, 1=Observer, 2=Contributor, 3=Guardian, 4=Champion, 5=Legend
    function getReputationTier(address _donor) public view returns (uint tier) {
        (, , , , , uint score) = getDonorIdentity(_donor);
        if (score >= 500) return 5;      // Legend
        if (score >= 250) return 4;      // Champion
        if (score >= 100) return 3;      // Guardian
        if (score >= 25) return 2;       // Contributor
        if (score >= 1) return 1;        // Observer
        return 0;                        // Unranked
    }
}
