// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CWBountyPool is Ownable, ReentrancyGuard {

    // ── Data Structures ──────────────────────────────────────────

    struct ScientistProfile {
        string institutionName;
        uint16 institutionSplitBps; // 0-10000
        address payable institutionWallet;
        bool registered;
    }

    enum BountyStatus { Open, Finalized, Cancelled }

    struct Bounty {
        address funder;
        uint256 amount;
        string diseaseTag;
        string criteria;
        uint256 deadline;
        BountyStatus status;
        uint256 claimCount;
    }

    enum ClaimStatus { Pending, Approved, Rejected }

    struct Claim {
        address scientist;
        string roId;
        string justification;
        ClaimStatus status;
        uint16 shareBps; // assigned by funder on approval
    }

    struct Escrow {
        uint256 amount;
        address scientist;
        string institutionName;
        uint256 createdAt;
        bool claimed;
    }

    // ── State ────────────────────────────────────────────────────

    mapping(uint256 => Bounty) public bounties;
    uint256 public nextBountyId;

    mapping(uint256 => mapping(uint256 => Claim)) public claims;

    mapping(address => ScientistProfile) public scientists;

    mapping(string => address payable) public institutionWallets;

    Escrow[] public escrows;

    uint256 public escrowPeriod = 365 days;
    uint16 public platformFeeBps = 250; // 2.5%
    address payable public treasury;

    // ── Events ───────────────────────────────────────────────────

    event ScientistRegistered(address indexed scientist, string institutionName, uint16 splitBps);
    event BountyCreated(uint256 indexed bountyId, address indexed funder, uint256 amount, string diseaseTag);
    event ClaimSubmitted(uint256 indexed bountyId, uint256 claimIndex, address indexed scientist, string roId);
    event ClaimApproved(uint256 indexed bountyId, uint256 claimIndex, uint16 shareBps);
    event ClaimRejected(uint256 indexed bountyId, uint256 claimIndex);
    event BountyFinalized(uint256 indexed bountyId, uint256 totalPaid);
    event BountyCancelled(uint256 indexed bountyId, uint256 refunded);
    event EscrowCreated(uint256 indexed escrowId, address indexed scientist, string institutionName, uint256 amount);
    event EscrowClaimed(uint256 indexed escrowId, address indexed institutionWallet, uint256 amount);
    event EscrowExpiredWithdraw(uint256 indexed escrowId, address indexed scientist, uint256 amount);
    event InstitutionWalletRegistered(string institutionName, address wallet);

    // ── Constructor ──────────────────────────────────────────────

    constructor(address founderWallet, address payable _treasury) Ownable(founderWallet) {
        require(_treasury != address(0), "Treasury cannot be zero");
        treasury = _treasury;
    }

    // ── Registration ─────────────────────────────────────────────

    function registerScientist(
        string calldata institutionName,
        uint16 institutionSplitBps
    ) external {
        require(bytes(institutionName).length > 0, "Institution name required");
        require(institutionSplitBps <= 10000, "Split exceeds 100%");

        // Look up institution wallet if registered
        address payable instWallet = institutionWallets[institutionName];

        scientists[msg.sender] = ScientistProfile({
            institutionName: institutionName,
            institutionSplitBps: institutionSplitBps,
            institutionWallet: instWallet,
            registered: true
        });

        emit ScientistRegistered(msg.sender, institutionName, institutionSplitBps);
    }

    // ── Bounty Lifecycle ─────────────────────────────────────────

    function createBounty(
        string calldata diseaseTag,
        string calldata criteria,
        uint256 deadline
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must lock ETH");
        require(bytes(diseaseTag).length > 0, "Disease tag required");
        require(bytes(criteria).length > 0, "Criteria required");
        require(deadline > block.timestamp, "Deadline must be in future");

        uint256 bountyId = nextBountyId++;

        bounties[bountyId] = Bounty({
            funder: msg.sender,
            amount: msg.value,
            diseaseTag: diseaseTag,
            criteria: criteria,
            deadline: deadline,
            status: BountyStatus.Open,
            claimCount: 0
        });

        emit BountyCreated(bountyId, msg.sender, msg.value, diseaseTag);
        return bountyId;
    }

    function submitClaim(
        uint256 bountyId,
        string calldata roId,
        string calldata justification
    ) external returns (uint256) {
        Bounty storage b = bounties[bountyId];
        require(b.funder != address(0), "Bounty does not exist");
        require(b.status == BountyStatus.Open, "Bounty not open");
        require(scientists[msg.sender].registered, "Must register as scientist first");
        require(bytes(roId).length > 0, "RO ID required");
        require(bytes(justification).length > 0, "Justification required");

        // Check for duplicate RO on this bounty
        for (uint256 i = 0; i < b.claimCount; i++) {
            require(
                keccak256(bytes(claims[bountyId][i].roId)) != keccak256(bytes(roId)),
                "RO already claimed on this bounty"
            );
        }

        uint256 claimIndex = b.claimCount++;

        claims[bountyId][claimIndex] = Claim({
            scientist: msg.sender,
            roId: roId,
            justification: justification,
            status: ClaimStatus.Pending,
            shareBps: 0
        });

        emit ClaimSubmitted(bountyId, claimIndex, msg.sender, roId);
        return claimIndex;
    }

    function approveClaim(
        uint256 bountyId,
        uint256 claimIndex,
        uint16 shareBps
    ) external {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.funder, "Only funder can approve");
        require(b.status == BountyStatus.Open, "Bounty not open");
        require(claimIndex < b.claimCount, "Invalid claim index");

        Claim storage c = claims[bountyId][claimIndex];
        require(c.status == ClaimStatus.Pending, "Claim not pending");
        require(shareBps > 0 && shareBps <= 10000, "Invalid share");

        c.status = ClaimStatus.Approved;
        c.shareBps = shareBps;

        emit ClaimApproved(bountyId, claimIndex, shareBps);
    }

    function rejectClaim(
        uint256 bountyId,
        uint256 claimIndex
    ) external {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.funder, "Only funder can reject");
        require(b.status == BountyStatus.Open, "Bounty not open");
        require(claimIndex < b.claimCount, "Invalid claim index");

        Claim storage c = claims[bountyId][claimIndex];
        require(c.status == ClaimStatus.Pending, "Claim not pending");

        c.status = ClaimStatus.Rejected;

        emit ClaimRejected(bountyId, claimIndex);
    }

    function finalizeBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.funder, "Only funder can finalize");
        require(b.status == BountyStatus.Open, "Bounty not open");

        // Verify approved shares sum to 10000
        uint256 totalShareBps;
        uint256 approvedCount;
        for (uint256 i = 0; i < b.claimCount; i++) {
            if (claims[bountyId][i].status == ClaimStatus.Approved) {
                totalShareBps += claims[bountyId][i].shareBps;
                approvedCount++;
            }
        }
        require(approvedCount > 0, "No approved claims");
        require(totalShareBps == 10000, "Approved shares must sum to 10000");

        b.status = BountyStatus.Finalized;

        // Deduct platform fee
        uint256 fee = (b.amount * platformFeeBps) / 10000;
        uint256 distributable = b.amount - fee;

        // Send fee to treasury
        if (fee > 0) {
            (bool feeOk, ) = treasury.call{value: fee}("");
            require(feeOk, "Fee transfer failed");
        }

        uint256 totalPaid;

        // Distribute to each approved claim
        for (uint256 i = 0; i < b.claimCount; i++) {
            Claim storage c = claims[bountyId][i];
            if (c.status != ClaimStatus.Approved) continue;

            uint256 claimPayout = (distributable * c.shareBps) / 10000;
            if (claimPayout == 0) continue;

            ScientistProfile storage sp = scientists[c.scientist];
            uint256 instShare = (claimPayout * sp.institutionSplitBps) / 10000;
            uint256 sciShare = claimPayout - instShare;

            // Pay scientist directly
            if (sciShare > 0) {
                (bool sciOk, ) = payable(c.scientist).call{value: sciShare}("");
                require(sciOk, "Scientist payment failed");
            }

            // Handle institution share
            if (instShare > 0) {
                address payable instWallet = institutionWallets[sp.institutionName];
                if (instWallet != address(0)) {
                    // Institution wallet registered — pay directly
                    (bool instOk, ) = instWallet.call{value: instShare}("");
                    require(instOk, "Institution payment failed");
                } else {
                    // No institution wallet — send to escrow
                    uint256 escrowId = escrows.length;
                    escrows.push(Escrow({
                        amount: instShare,
                        scientist: c.scientist,
                        institutionName: sp.institutionName,
                        createdAt: block.timestamp,
                        claimed: false
                    }));
                    emit EscrowCreated(escrowId, c.scientist, sp.institutionName, instShare);
                }
            }

            totalPaid += claimPayout;
        }

        emit BountyFinalized(bountyId, totalPaid);
    }

    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.funder, "Only funder can cancel");
        require(b.status == BountyStatus.Open, "Bounty not open");
        require(block.timestamp >= b.deadline, "Cannot cancel before deadline");

        // Check no approved claims
        for (uint256 i = 0; i < b.claimCount; i++) {
            require(
                claims[bountyId][i].status != ClaimStatus.Approved,
                "Cannot cancel with approved claims"
            );
        }

        b.status = BountyStatus.Cancelled;
        uint256 refund = b.amount;

        (bool ok, ) = payable(b.funder).call{value: refund}("");
        require(ok, "Refund failed");

        emit BountyCancelled(bountyId, refund);
    }

    // ── Escrow ───────────────────────────────────────────────────

    function claimEscrow(uint256 escrowId) external nonReentrant {
        require(escrowId < escrows.length, "Invalid escrow ID");
        Escrow storage e = escrows[escrowId];
        require(!e.claimed, "Already claimed");

        address payable instWallet = institutionWallets[e.institutionName];
        require(instWallet != address(0), "Institution wallet not registered");

        // CEI: zero amount before transfer
        uint256 amount = e.amount;
        e.amount = 0;
        e.claimed = true;

        (bool ok, ) = instWallet.call{value: amount}("");
        require(ok, "Escrow transfer failed");

        emit EscrowClaimed(escrowId, instWallet, amount);
    }

    function withdrawExpiredEscrow(uint256 escrowId) external nonReentrant {
        require(escrowId < escrows.length, "Invalid escrow ID");
        Escrow storage e = escrows[escrowId];
        require(!e.claimed, "Already claimed");
        require(msg.sender == e.scientist, "Only scientist can withdraw");
        require(block.timestamp >= e.createdAt + escrowPeriod, "Escrow period not elapsed");

        // Institution must still be unregistered
        require(
            institutionWallets[e.institutionName] == address(0),
            "Institution wallet registered - use claimEscrow"
        );

        // CEI: zero amount before transfer
        uint256 amount = e.amount;
        e.amount = 0;
        e.claimed = true;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdrawal failed");

        emit EscrowExpiredWithdraw(escrowId, msg.sender, amount);
    }

    // ── Institution Wallet ───────────────────────────────────────

    function registerInstitutionWallet(
        string calldata institutionName,
        address payable wallet
    ) external onlyOwner {
        require(bytes(institutionName).length > 0, "Name required");
        require(wallet != address(0), "Invalid wallet");

        institutionWallets[institutionName] = wallet;

        emit InstitutionWalletRegistered(institutionName, wallet);
    }

    // ── Admin ────────────────────────────────────────────────────

    function setEscrowPeriod(uint256 _period) external onlyOwner {
        escrowPeriod = _period;
    }

    function setPlatformFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        platformFeeBps = _bps;
    }

    function setTreasury(address payable _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ── Views ────────────────────────────────────────────────────

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    function getClaim(uint256 bountyId, uint256 claimIndex) external view returns (Claim memory) {
        return claims[bountyId][claimIndex];
    }

    function getScientist(address addr) external view returns (ScientistProfile memory) {
        return scientists[addr];
    }

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        require(escrowId < escrows.length, "Invalid escrow ID");
        return escrows[escrowId];
    }

    function escrowCount() external view returns (uint256) {
        return escrows.length;
    }

    function totalBounties() external view returns (uint256) {
        return nextBountyId;
    }
}
