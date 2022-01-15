pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Contract which has treasury allocated from Stablec
 *
 * Reports back it's mark to market (so DAO can rebalance IV accordingly, from time to time)
 */
interface ITreasuryAllocation {
    /** 
     * mark to market of treasury investment, denominated in Treasury Stablec
     */
    function reval() external view returns (uint256);
}