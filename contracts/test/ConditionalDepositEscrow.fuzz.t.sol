// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConditionalDepositEscrow, IERC20Minimal} from "../src/ConditionalDepositEscrow.sol";
import {MockERC20} from "./MockERC20.sol";
import {TestBase} from "./TestBase.sol";

contract ConditionalDepositEscrowFuzzTest is TestBase {
    function testFuzzCancellationNeverForfeitsEntireDeposit(uint96 deposit, uint96 fee) public {
        deposit = uint96((uint256(deposit) % 1_000_000_000) + 2);
        fee = uint96(uint256(fee) % (deposit - 1));
        address patient = address(0xA11CE);
        MockERC20 token = new MockERC20();
        ConditionalDepositEscrow escrow = new ConditionalDepositEscrow(
            IERC20Minimal(address(token)),
            address(0xA),
            address(0xB),
            address(0xFEE),
            deposit,
            fee,
            0,
            90 days,
            90 days
        );
        token.mint(patient, deposit);
        vm.startPrank(patient);
        token.approve(address(escrow), deposit);
        escrow.fund(keccak256(abi.encode(deposit, fee)));
        escrow.cancel(keccak256(abi.encode(deposit, fee)));
        vm.stopPrank();
        assertEq(token.balanceOf(patient), deposit - fee);
        assertTrue(token.balanceOf(patient) > 0);
    }
}
