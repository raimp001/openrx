// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Generic condition-based token escrow. Commitment identifiers must be
/// random and must never encode or hash identity, health, or service data.
contract ConditionalDepositEscrow {
    enum Status {
        Created,
        Funded,
        Extended,
        ConditionVerified,
        Refunded,
        Cancelled,
        Expired
    }

    enum RefundStatus {
        None,
        Pending,
        Complete
    }

    struct Commitment {
        address depositor;
        uint96 amount;
        uint64 createdAt;
        uint64 currentDeadline;
        bool extensionUsed;
        Status status;
        RefundStatus refundStatus;
    }

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REFUND_ROLE = keccak256("REFUND_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20Minimal public immutable token;
    address public immutable feeRecipient;
    uint96 public immutable depositAmount;
    uint96 public immutable cancellationFee;
    uint96 public immutable completionFee;
    uint64 public immutable initialWindow;
    uint64 public immutable extensionWindow;

    bool public paused;
    uint256 private _entered = 1;

    mapping(bytes32 role => mapping(address account => bool allowed)) private _roles;
    mapping(bytes32 commitmentId => Commitment commitment) public commitments;

    event RoleUpdated(bytes32 indexed role, address indexed account, bool allowed);
    event PauseUpdated(bool paused);
    event Deposited(bytes32 indexed commitmentId, address indexed depositor, uint256 amount, uint64 deadline);
    event DeadlineExtended(bytes32 indexed commitmentId, uint64 deadline);
    event ConditionConfirmed(bytes32 indexed commitmentId);
    event Refunded(bytes32 indexed commitmentId, address indexed recipient, uint256 amount, uint8 reason);

    error Unauthorized();
    error Paused();
    error InvalidConfiguration();
    error InvalidCommitment();
    error InvalidState();
    error DeadlineNotReached();
    error DeadlinePassed();
    error ExtensionAlreadyUsed();
    error TokenTransferFailed();
    error Reentrancy();

    modifier onlyRole(bytes32 role) {
        if (!_roles[role][msg.sender]) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier nonReentrant() {
        if (_entered != 1) revert Reentrancy();
        _entered = 2;
        _;
        _entered = 1;
    }

    constructor(
        IERC20Minimal token_,
        address adminMultisig_,
        address verifier_,
        address feeRecipient_,
        uint96 depositAmount_,
        uint96 cancellationFee_,
        uint96 completionFee_,
        uint64 initialWindow_,
        uint64 extensionWindow_
    ) {
        if (
            address(token_) == address(0) ||
            adminMultisig_ == address(0) ||
            verifier_ == address(0) ||
            feeRecipient_ == address(0) ||
            depositAmount_ == 0 ||
            cancellationFee_ >= depositAmount_ ||
            completionFee_ >= depositAmount_ ||
            initialWindow_ == 0 ||
            extensionWindow_ == 0
        ) revert InvalidConfiguration();

        token = token_;
        feeRecipient = feeRecipient_;
        depositAmount = depositAmount_;
        cancellationFee = cancellationFee_;
        completionFee = completionFee_;
        initialWindow = initialWindow_;
        extensionWindow = extensionWindow_;

        _roles[DEFAULT_ADMIN_ROLE][adminMultisig_] = true;
        _roles[VERIFIER_ROLE][verifier_] = true;
        _roles[REFUND_ROLE][adminMultisig_] = true;
        _roles[PAUSER_ROLE][adminMultisig_] = true;

        emit RoleUpdated(DEFAULT_ADMIN_ROLE, adminMultisig_, true);
        emit RoleUpdated(VERIFIER_ROLE, verifier_, true);
        emit RoleUpdated(REFUND_ROLE, adminMultisig_, true);
        emit RoleUpdated(PAUSER_ROLE, adminMultisig_, true);
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }

    function setRole(bytes32 role, address account, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidConfiguration();
        _roles[role][account] = allowed;
        emit RoleUpdated(role, account, allowed);
    }

    function setPaused(bool value) external onlyRole(PAUSER_ROLE) {
        paused = value;
        emit PauseUpdated(value);
    }

    function fund(bytes32 commitmentId) external whenNotPaused nonReentrant {
        if (commitmentId == bytes32(0) || commitments[commitmentId].depositor != address(0)) {
            revert InvalidCommitment();
        }

        uint64 createdAt = uint64(block.timestamp);
        uint64 deadline = createdAt + initialWindow;
        commitments[commitmentId] = Commitment({
            depositor: msg.sender,
            amount: depositAmount,
            createdAt: createdAt,
            currentDeadline: deadline,
            extensionUsed: false,
            status: Status.Funded,
            refundStatus: RefundStatus.None
        });

        _safeTransferFrom(msg.sender, address(this), depositAmount);
        emit Deposited(commitmentId, msg.sender, depositAmount, deadline);
    }

    function extend(bytes32 commitmentId) external whenNotPaused {
        Commitment storage commitment = _requireDepositor(commitmentId);
        if (commitment.status != Status.Funded || commitment.extensionUsed) {
            if (commitment.extensionUsed) revert ExtensionAlreadyUsed();
            revert InvalidState();
        }
        if (block.timestamp > commitment.currentDeadline) revert DeadlinePassed();

        commitment.extensionUsed = true;
        commitment.status = Status.Extended;
        commitment.currentDeadline += extensionWindow;
        emit DeadlineExtended(commitmentId, commitment.currentDeadline);
    }

    function verifyCondition(bytes32 commitmentId) external whenNotPaused onlyRole(VERIFIER_ROLE) nonReentrant {
        Commitment storage commitment = _requireFunded(commitmentId);
        commitment.status = Status.ConditionVerified;
        emit ConditionConfirmed(commitmentId);
        _refund(commitmentId, commitment, completionFee, 0);
    }

    function cancel(bytes32 commitmentId) external whenNotPaused nonReentrant {
        Commitment storage commitment = _requireDepositor(commitmentId);
        if (commitment.status != Status.Funded && commitment.status != Status.Extended) revert InvalidState();
        commitment.status = Status.Cancelled;
        _refund(commitmentId, commitment, cancellationFee, 1);
    }

    function expire(bytes32 commitmentId) external whenNotPaused nonReentrant {
        Commitment storage commitment = _requireFunded(commitmentId);
        if (block.timestamp <= commitment.currentDeadline) revert DeadlineNotReached();
        commitment.status = Status.Expired;
        _refund(commitmentId, commitment, cancellationFee, 2);
    }

    function exceptionRefund(bytes32 commitmentId) external onlyRole(REFUND_ROLE) nonReentrant {
        Commitment storage commitment = _requireFunded(commitmentId);
        _refund(commitmentId, commitment, 0, 3);
    }

    /// @notice Remains available while paused so the multisig can unwind funds.
    function emergencyRefund(bytes32 commitmentId) external onlyRole(REFUND_ROLE) nonReentrant {
        Commitment storage commitment = _requireFunded(commitmentId);
        _refund(commitmentId, commitment, 0, 4);
    }

    function _requireDepositor(bytes32 commitmentId) private view returns (Commitment storage commitment) {
        commitment = commitments[commitmentId];
        if (commitment.depositor == address(0)) revert InvalidCommitment();
        if (commitment.depositor != msg.sender) revert Unauthorized();
    }

    function _requireFunded(bytes32 commitmentId) private view returns (Commitment storage commitment) {
        commitment = commitments[commitmentId];
        if (commitment.depositor == address(0)) revert InvalidCommitment();
        if (commitment.status != Status.Funded && commitment.status != Status.Extended) revert InvalidState();
        if (commitment.refundStatus != RefundStatus.None) revert InvalidState();
    }

    function _refund(
        bytes32 commitmentId,
        Commitment storage commitment,
        uint96 fee,
        uint8 reason
    ) private {
        commitment.refundStatus = RefundStatus.Pending;
        uint256 refundAmount = uint256(commitment.amount) - fee;
        if (refundAmount > 0) _safeTransfer(commitment.depositor, refundAmount);
        if (fee > 0) _safeTransfer(feeRecipient, fee);
        commitment.refundStatus = RefundStatus.Complete;
        if (reason == 0 || reason == 3 || reason == 4) commitment.status = Status.Refunded;
        emit Refunded(commitmentId, commitment.depositor, refundAmount, reason);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, bytes memory data) = address(token).call(
            abi.encodeCall(IERC20Minimal.transfer, (to, amount))
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory data) = address(token).call(
            abi.encodeCall(IERC20Minimal.transferFrom, (from, to, amount))
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }
}
