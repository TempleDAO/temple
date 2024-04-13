pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/governance/ChiefApprovals.sol)

import { DSThing } from "contracts/templegold/governance/Util.sol";
import { IStakedTempleVoteToken } from "contracts/interfaces/templegold/IStakedTempleVoteToken.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";


contract DSChiefApprovals is DSThing {
    mapping(bytes32=>address[]) public slates;
    mapping(address=>bytes32) public votes;
    mapping(address=>uint256) public approvals;
    mapping(address=>uint256) public deposits;
    IStakedTempleVoteToken public gov; // voting token that gets locked up
    // todo: do we need secondary voting mechanisms?
    IStakedTempleVoteToken public iou; // non-voting representation of a token, for e.g. secondary voting mechanisms
    address public hat; // the chieftain's hat

    uint256 public MAX_YAYS;

    mapping(address=>uint256) public last;

    bool public live;

    uint256 constant LAUNCH_THRESHOLD = 80_000 * 10 ** 18; // 80K MKR launch threshold

    event Etch(bytes32 indexed slate);

    // IOU constructed outside this contract reduces deployment costs significantly
    // lock/free/vote are quite sensitive to token invariants. Caution is advised.
    constructor(
        address _rescuer,
        address _executor,
        address gov_,
        address iou_,
        uint256 MAX_YAYS_
    ) DSThing(_rescuer, _executor) {
        gov = IStakedTempleVoteToken(gov_);
        iou = IStakedTempleVoteToken(iou_);
        MAX_YAYS = MAX_YAYS_;
    }

    function launch()
        public
        note
    {
        require(!live);
        require(hat == address(0) && approvals[address(0)] >= LAUNCH_THRESHOLD);
        live = true;
    }

    function lock(uint256 wad)
        public
        note
    {
        last[msg.sender] = block.number;
        gov.pull(msg.sender, wad);
        iou.mint(msg.sender, wad);
        deposits[msg.sender] = deposits[msg.sender] + wad;
        addWeight(wad, votes[msg.sender]);
    }

    function free(uint256 wad)
        public
        note
    {
        require(block.number > last[msg.sender]);
        deposits[msg.sender] = deposits[msg.sender] - wad;
        subWeight(wad, votes[msg.sender]);
        iou.burnFrom(msg.sender, wad);
        gov.push(msg.sender, wad);
    }

    function etch(address[] memory yays)
        public
        note
        returns (bytes32 slate)
    {
        require( yays.length <= MAX_YAYS );
        requireByteOrderedSet(yays);

        bytes32 hash = keccak256(abi.encodePacked(yays));
        slates[hash] = yays;
        emit Etch(hash);
        return hash;
    }

    function vote(address[] memory yays) public returns (bytes32)
        // note  both sub-calls note
    {
        bytes32 slate = etch(yays);
        vote(slate);
        return slate;
    }

    function vote(bytes32 slate)
        public
        note
    {
        require(slates[slate].length > 0 ||
            slate == 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470, "ds-chief-invalid-slate");
        uint weight = deposits[msg.sender];
        subWeight(weight, votes[msg.sender]);
        votes[msg.sender] = slate;
        addWeight(weight, votes[msg.sender]);
    }

    // like `drop`/`swap` except simply "elect this address if it is higher than current hat"
    function lift(address whom)
        public
        note
    {
        require(approvals[whom] > approvals[hat]);
        hat = whom;
    }

    function addWeight(uint weight, bytes32 slate)
        internal
    {
        address[] storage yays = slates[slate];
        for( uint i = 0; i < yays.length; i++) {
            approvals[yays[i]] = approvals[yays[i]] + weight;
        }
    }

    function subWeight(uint weight, bytes32 slate)
        internal
    {
        address[] storage yays = slates[slate];
        for( uint i = 0; i < yays.length; i++) {
            approvals[yays[i]] = approvals[yays[i]] - weight;
        }
    }

    // Throws unless the array of addresses is a ordered set.
    function requireByteOrderedSet(address[] memory yays)
        internal
        pure
    {
        if( yays.length == 0 || yays.length == 1 ) {
            return;
        }
        for( uint i = 0; i < yays.length - 1; i++ ) {
            // strict inequality ensures both ordering and uniqueness
            // require(uint(yays[i]) < uint(yays[i+1]));
            require(yays[i] < yays[i+1]);
        }
    }
}