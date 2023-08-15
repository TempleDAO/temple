pragma solidity 0.8.18;

interface IShard {
    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) external;
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data) external;
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external;
}