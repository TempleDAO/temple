pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/ClearableEnumerableSet.sol)


import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @dev
 * Clearing EnumerableSet is very expensive. This is done by iterating over all values and calling `remove` on each. 
 * This is very expensive and can cause exceeding gas limits. This library adds function `clear`and delegates calls to
 * all other EnumerableSet.AddressSet functions
 */
library ClearableEnumerableSet {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct ClearableAddressSet {
        uint256 _setId;
        // setId => AddressSet
        mapping(uint256 => EnumerableSet.AddressSet) _sets;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(ClearableAddressSet storage set, address value) internal returns (bool) {
        return set._sets[set._setId].add(value);
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(ClearableAddressSet storage set, address value) internal returns (bool) {
        return set._sets[set._setId].remove(value);
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(ClearableAddressSet storage set, address value) internal view returns (bool) {
        return set._sets[set._setId].contains(value);
    }

    /**
     * @dev Returns the number of values in the set. O(1).
     */
    function length(ClearableAddressSet storage set) internal view returns (uint256) {
        return set._sets[set._setId].length();
    }

    /**
     * @dev Returns the value stored at position `index` in the set. O(1).
     *
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function at(ClearableAddressSet storage set, uint256 index) internal view returns (address) {
        return set._sets[set._setId].at(index);
    }

     /**
     * @dev Return the entire set in an array
     *
     * WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
     * to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
     * this function has an unbounded cost, and using it as part of a state-changing function may render the function
     * uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.
     */
    function values(ClearableAddressSet storage set) internal view returns (address[] memory) {
        return set._sets[set._setId].values();
    }

    /// @dev Increment _setId by 1 to create a new set
    function clear(ClearableAddressSet storage set) internal {
        set._setId++;
    }
}