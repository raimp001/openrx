// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConditionalDepositEscrow, IERC20Minimal} from "../src/ConditionalDepositEscrow.sol";
import {MockERC20} from "./MockERC20.sol";
import {TestBase} from "./TestBase.sol";

contract ConditionalDepositEscrowTest is TestBase {
    MockERC20 internal token;
    ConditionalDepositEscrow internal escrow;
    address internal patient = address(0xA11CE);
    address internal admin = address(0xA);
    address internal verifier = address(0xB);
    address internal feeRecipient = address(0xFEE);
    uint96 internal constant DEPOSIT = 20e6;
    uint96 internal constant FEE = 2e6;

    function setUp() public {
        token = new MockERC20();
        escrow = new ConditionalDepositEscrow(
            IERC20Minimal(address(token)),
            admin,
            verifier,
            feeRecipient,
            DEPOSIT,
            FEE,
            0,
            90 days,
            90 days
        );
        token.mint(patient, 100e6);
        vm.prank(patient);
        token.approve(address(escrow), DEPOSIT);
    }

    function testFundAndVerifiedCompletionReturnsFullDeposit() public {
        bytes32 id = keccak256("random-commitment-a");
        vm.prank(patient);
        escrow.fund(id);
        assertEq(token.balanceOf(address(escrow)), DEPOSIT);

        vm.prank(verifier);
        escrow.verifyCondition(id);
        assertEq(token.balanceOf(patient), 100e6);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCancellationReturnsDepositMinusFee() public {
        bytes32 id = keccak256("random-commitment-b");
        vm.prank(patient);
        escrow.fund(id);

        vm.prank(patient);
        escrow.cancel(id);
        assertEq(token.balanceOf(patient), 98e6);
        assertEq(token.balanceOf(feeRecipient), FEE);
    }

    function testOneExtensionOnly() public {
        bytes32 id = keccak256("random-commitment-c");
        vm.prank(patient);
        escrow.fund(id);

        vm.prank(patient);
        escrow.extend(id);
        vm.expectRevert(ConditionalDepositEscrow.ExtensionAlreadyUsed.selector);
        vm.prank(patient);
        escrow.extend(id);
    }

    function testCannotExpireBeforeDeadline() public {
        bytes32 id = keccak256("random-commitment-d");
        vm.prank(patient);
        escrow.fund(id);
        vm.expectRevert(ConditionalDepositEscrow.DeadlineNotReached.selector);
        escrow.expire(id);
    }

    function testExpiryReturnsDepositMinusFee() public {
        bytes32 id = keccak256("random-commitment-e");
        vm.prank(patient);
        escrow.fund(id);
        vm.warp(block.timestamp + 90 days + 1);
        escrow.expire(id);
        assertEq(token.balanceOf(patient), 98e6);
        assertEq(token.balanceOf(feeRecipient), FEE);
    }

    function testOnlyVerifierCanConfirmCondition() public {
        bytes32 id = keccak256("random-commitment-f");
        vm.prank(patient);
        escrow.fund(id);
        vm.expectRevert(ConditionalDepositEscrow.Unauthorized.selector);
        vm.prank(patient);
        escrow.verifyCondition(id);
    }

    function testDuplicateFundingIsRejected() public {
        bytes32 id = keccak256("random-commitment-g");
        vm.prank(patient);
        escrow.fund(id);
        token.mint(patient, DEPOSIT);
        vm.prank(patient);
        token.approve(address(escrow), DEPOSIT);
        vm.expectRevert(ConditionalDepositEscrow.InvalidCommitment.selector);
        vm.prank(patient);
        escrow.fund(id);
    }

    function testEmergencyRefundWorksWhilePaused() public {
        bytes32 id = keccak256("random-commitment-h");
        vm.prank(patient);
        escrow.fund(id);
        vm.prank(admin);
        escrow.setPaused(true);
        vm.prank(admin);
        escrow.emergencyRefund(id);
        assertEq(token.balanceOf(patient), 100e6);
    }
}
