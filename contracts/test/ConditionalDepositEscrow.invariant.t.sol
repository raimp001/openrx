// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConditionalDepositEscrow, IERC20Minimal} from "../src/ConditionalDepositEscrow.sol";
import {MockERC20} from "./MockERC20.sol";
import {TestBase} from "./TestBase.sol";

contract ConditionalDepositEscrowInvariantTest is TestBase {
    MockERC20 internal token;
    ConditionalDepositEscrow internal escrow;

    function setUp() public {
        token = new MockERC20();
        escrow = new ConditionalDepositEscrow(
            IERC20Minimal(address(token)),
            address(this),
            address(this),
            address(0xFEE),
            20e6,
            2e6,
            0,
            90 days,
            90 days
        );
    }

    function invariantContractBalanceCannotExceedFundedTokenSupply() public view {
        assertTrue(token.balanceOf(address(escrow)) <= 20e6);
    }
}
