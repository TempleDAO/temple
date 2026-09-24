// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;

/// @title IWishingWell
/// @notice A persistent, non-custodial registry of potential demand for Treasury auctions.
/// @dev Wishes do not move tokens, grant allowances, reserve liquidity or guarantee execution.
/// There is one stored wish per account/target token, shared across directions and payment assets.
/// Amounts are stated intent, not validated wallet balances. Token addresses identify assets, that is,
/// the registry does not certify their legitimacy or call their token contracts.
interface IWishingWell {
    /// @notice Whether the account wants to sell the target token or buy into it.
    enum Direction {
        /// @dev Amount is expressed in target-token base units.
        Sell,
        /// @dev Amount is expressed in payment-asset base units.
        Buy
    }

    /// @notice The latest stored wish for an account/target-token pair.
    /// @dev Storage presence alone does not establish eligibility; use activeAmount to filter it.
    struct Wish {
        /// @notice Target token for Sell: a different, nonzero payment asset for Buy.
        address amountAsset;
        /// @notice Desired quantity in amountAsset base units, without decimal normalization.
        uint128 amount;
        /// @notice Exclusive Unix expiry timestamp in seconds; inactive at or after this time.
        uint64 expiresAt;
        /// @notice Whether this record represents sell demand or buy demand.
        Direction direction;
    }

    /// @notice An authorization to set or replace a wish through a relayer.
    /// @dev Every field is signed. The EIP-712 type name is "Wish", not "SignedWish".
    /// Absolute expiry prevents delayed submission from extending the user's intended lifetime.
    struct SignedWish {
        /// @notice Nonzero owner of the wish and EOA or ERC-1271 signer.
        address account;
        /// @notice Nonzero target-token identifier; also determines the account's nonce scope.
        address targetToken;
        /// @notice Asset denominating amount: target token for Sell, another asset for Buy.
        address amountAsset;
        /// @notice Requested sell or buy direction.
        Direction direction;
        /// @notice Nonzero quantity in amountAsset base units.
        uint128 amount;
        /// @notice Exclusive Unix expiry timestamp in seconds, strictly after submission time.
        uint64 expiresAt;
        /// @notice Current nonce for account/targetToken; consumed on successful submission.
        uint256 nonce;
        /// @notice Exclusive Unix submission deadline in seconds; must not exceed expiresAt.
        uint64 submissionDeadline;
    }

    /// @notice Wish amount, duration, expiry, denomination or deadline relationship is invalid.
    error InvalidWish();
    /// @notice Signature fails EOA recovery or ERC-1271 verification for the stated account.
    error InvalidSignature();
    /// @notice Signed nonce differs from the current nonce for the account/target-token pair.
    error InvalidNonce();
    /// @notice Submission is at or after the signed submission deadline.
    error SignatureExpired();
    /// @notice Account list exceeds the batch cap, contains zero, or is not strictly ascending.
    error InvalidAccountList();

    /// @notice Emitted for every successful direct or signed wish creation/replacement.
    /// @param account Owner of the wish; not necessarily the transaction sender for relayed wishes.
    /// @param targetToken Target token whose existing record is replaced.
    /// @param amountAsset Asset denominating the wish amount.
    /// @param direction Requested sell or buy direction.
    /// @param amount New quantity in amountAsset base units.
    /// @param expiresAt Exclusive expiry timestamp in seconds.
    /// @param nonce Consumed nonce; the next available nonce is this value plus one.
    event WishSet(
        address indexed account,
        address indexed targetToken,
        address indexed amountAsset,
        Direction direction,
        uint128 amount,
        uint64 expiresAt,
        uint256 nonce
    );
    /// @notice Emitted even when revoking a missing or already-revoked wish.
    /// @param account Caller whose wish is cleared and pending signature nonce is invalidated.
    /// @param targetToken Target token identifying the record and nonce scope.
    /// @param nonce Consumed nonce; the next available nonce is this value plus one.
    event WishRevoked(address indexed account, address indexed targetToken, uint256 nonce);

    /// @notice Emitted when demand-counting exclusion is set, including unchanged values.
    /// @param targetToken Token for which the exclusion applies, across both directions.
    /// @param account Account whose wishes are included or ignored.
    /// @param excluded True to ignore the account's wish; false to apply normal eligibility checks.
    event ExclusionSet(address indexed targetToken, address indexed account, bool excluded);

    function MAX_ACCOUNTS() external view returns (uint256);

    /// @notice Create or replace the caller's wish for a target token.
    /// @dev Replaces any prior direction/payment asset for the same target and advances its nonce,
    /// invalidating signatures using earlier nonces. Expiry is now + duration, not prior expiry + duration.
    /// Excluded accounts may still set wishes, but those wishes contribute zero while excluded.
    /// Reverts for zero addresses, zero amount/duration, invalid denomination or uint64 expiry overflow.
    /// @param targetToken Nonzero target token the caller wants to sell or acquire.
    /// @param direction Sell or Buy relative to targetToken.
    /// @param amountAsset For Sell, must equal targetToken; for Buy, must be nonzero and different.
    /// @param amount Nonzero quantity in amountAsset base units.
    /// @param duration Lifetime in seconds from the current block timestamp.
    function setWish(address targetToken, Direction direction, address amountAsset, uint128 amount, uint64 duration)
        external;

    /// @notice Relay an account's signed authorization to create or replace its wish.
    /// @dev Callable by anyone. Supports EOA and ERC-1271 verification. The signature binds all
    /// fields plus the EIP-712 domain (chain and this contract). Submission must precede both
    /// deadlines, with submissionDeadline <= expiresAt, and use the current account/target nonce.
    /// Successful submission consumes that nonce. Failed calls preserve the existing record and nonce.
    /// Grants no token-transfer permission. All normal wish validation and exclusion rules apply.
    /// @param wish Complete signed payload with absolute expiry and submission deadline.
    /// @param signature Signature accepted by the account's EOA or ERC-1271 validation mechanism.
    function setWishBySignature(SignedWish calldata wish, bytes calldata signature) external;

    /// @notice Clear the caller's wish and invalidate its current signing nonce for a target token.
    /// @dev Allowed while excluded and after expiry. Advances the nonce even if no record exists,
    /// allowing pending off-chain signatures to be invalidated. Does not affect other tokens/accounts.
    /// @param targetToken Nonzero target token identifying the caller's record and nonce scope.
    function revokeWish(address targetToken) external;

    /// @notice Read the latest stored record without filtering expiry or exclusion.
    /// @dev Replacement overwrites the previous record; this is not historical enumeration.
    /// Expired/excluded records remain readable. Missing or revoked records return zeroed fields.
    /// @param account Owner of the wish to read.
    /// @param targetToken Target-token identifier of the record.
    /// @return The stored wish, which may no longer contribute to active demand.
    function getWish(address account, address targetToken) external view returns (Wish memory);

    /// @notice Read an account's currently eligible amount for a specific market and direction.
    /// @dev Returns zero for missing, revoked, expired or excluded wishes, or mismatched direction
    /// or amount asset. Expiry is effective at block.timestamp >= expiresAt without a transaction.
    /// Does not check wallet balances, token approvals, or eventual auction participation.
    /// @param account Owner of the wish to evaluate.
    /// @param targetToken Target-token identifier to query.
    /// @param direction Required sell or buy direction.
    /// @param amountAsset Required denomination asset; no conversion between assets is performed.
    /// @return Eligible quantity in amountAsset base units, or zero.
    function activeAmount(address account, address targetToken, Direction direction, address amountAsset)
        external
        view
        returns (uint256);

    /// @notice Sum eligible wishes for the supplied accounts at the current block timestamp.
    /// @dev Applies activeAmount filtering. The current implementation allows at most 100 accounts
    /// per call; this is a computation bound, not a limit on registered users. Accounts must be
    /// nonzero and strictly ascending by numeric address value, rejecting duplicates and unsorted lists.
    /// An empty list returns zero. This is only a subtotal unless every relevant account is supplied.
    /// For larger populations, callers must use disjoint batches at the same block and sum off-chain.
    /// @param targetToken Common target-token identifier for all queried wishes.
    /// @param direction Common sell or buy direction to include.
    /// @param amountAsset Common denomination asset; unlike asset quantities are never combined.
    /// @param accounts Sorted, unique account addresses to include; the registry does not enumerate them.
    /// @return Sum of eligible amounts in amountAsset base units for the supplied accounts only.
    function totalForAccounts(
        address targetToken,
        Direction direction,
        address amountAsset,
        address[] calldata accounts
    ) external view returns (uint256);

    /// @notice Compute the EIP-712 digest to sign for a relayed wish.
    /// @dev Uses the deployment-configured domain name and version, the current chain ID and this contract address.
    /// Read the deployed values from name(), version() or eip712Domain()
    /// Hashing does not validate the payload, nonce, expiry or signature, and does not change state.
    /// @param wish Complete payload to hash, using EIP-712 primary type "Wish".
    /// @return Domain-separated digest for EOA signing or ERC-1271 verification.
    function wishDigest(SignedWish calldata wish) external view returns (bytes32);

    /// @notice Include or exclude an account's wish from demand counting for one target token.
    /// @dev Only a permitted operator may call. Does not delete or mutate the
    /// wish or nonce. Unexcluding restores its contribution only if otherwise active. Does not block
    /// wish submission/revocation and grants no authority over auction participation or user assets.
    /// @param targetToken Nonzero token for which the exclusion applies, across directions/assets.
    /// @param account Nonzero account whose contribution is affected.
    /// @param excluded True to ignore its contribution, False to restore normal eligibility checks.
    function setExcluded(address targetToken, address account, bool excluded) external;
}
