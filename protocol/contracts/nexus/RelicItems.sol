pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";


interface IRelic { 
    function getRelicId(address _owner) external view returns (uint256);
    function hasRelic(address _owner) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract RelicItems is
    ERC1155,
    Ownable,
    Pausable,
    ERC1155Burnable,
    ERC1155Supply,
    ReentrancyGuard
{
    constructor() ERC1155("") {}

    // @dev Partner Minting directly on this contract 
    // @dev whitelisted partners
    mapping (address => bool) public whiteListedPartners;
    // @dev itemId for each partner
    // TODO: switch this around
    mapping (address => uint256) public partnerId;
    // whitelister contracts
    mapping (address => bool) public whitelisters;
    // whitelisted users so they can mint themselves
    mapping (address => mapping (uint256 => bool)) public whiteListedUsers;
    // URIs
    mapping (uint256 => string) public tokenURIs;

    // @dev Relic.sol
    IRelic private RELIC;

    modifier isRelic{
        require(msg.sender==address(RELIC));
        _;
    }

    //------- External -------//

    // users mint authorized item
    function mintFromUser(uint256 _itemId) external nonReentrant {
        // DEACTIVATED FOR TESTING
        // require(whiteListedUsers[msg.sender][_itemId], "You cannot retrieve this item");
        _mint(msg.sender, _itemId, 1,"");
        whiteListedUsers[msg.sender][_itemId] = false;
    }

    // @dev called from Relic when transfering items from Templar wallet into Relic
    function equipItems(address _ownerAddress, uint256[] memory _itemIds, uint256[] memory _amounts) external isRelic {
        
        _beforeTokenTransfer(msg.sender, _ownerAddress, address(RELIC), _itemIds, _amounts, "");
        // transfer to Relic
        _safeBatchTransferFrom(_ownerAddress, address(RELIC), _itemIds, _amounts, "");
    }

     // @dev called from Relic when transfering items from Relic into Templar wallet
    function unEquipItems(address _target, uint256[] memory _itemIds, uint256[] memory _amounts) external isRelic {
        
        _beforeTokenTransfer(address(RELIC), address(RELIC), _target, _itemIds, _amounts, "");

        // transfer to target
        _safeBatchTransferFrom( address(RELIC), _target, _itemIds, _amounts, "");
    }

    // @dev called from Relic during Transmutations
    function mintFromRelic(uint256 _itemId, uint256 _amount) external isRelic{
        _mint(address(RELIC), _itemId, _amount,"");
    }

    // @dev called from Relic during Transmutations
    function burnFromRelic(uint256 _itemId, uint256 _amount) external isRelic{
        _burn(address(RELIC), _itemId, _amount);
    }

     // @dev How partners mint their items
    function partnerMint(
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory data
    ) external {
        require(whiteListedPartners[msg.sender], "You're not authorised to mint");
        require(partnerId[msg.sender]==_id, "This isn't your reserved itemId");
        _mint(_to, _id, _amount, data);
        // revoke whitelist
        whiteListedPartners[msg.sender]=false;
    }

    function uri(uint256 _id) override public view returns(string memory){
        return tokenURIs[_id];
    }

    // TODO : check that this whitelister is authorised for this index !
    function whitelistUser(address _userAddress, uint256 _itemId) external {
        require(whitelisters[msg.sender], "Not authorised");
        whiteListedUsers[_userAddress][_itemId]= true;
    }

    //------- Owner -------//

    // @dev authorise a partner to mint an item
    function addPartner(address _toAdd, uint256 _assignedItemId) external onlyOwner{
        whiteListedPartners[_toAdd] = true;
        partnerId[_toAdd]=_assignedItemId;
    }

    function whiteListItems(address _authorised, uint256[] memory _allowedIds) external onlyOwner{
        for(uint i = 0;i<_allowedIds.length;i++){
            partnerId[_authorised]=_allowedIds[i];
        }
    }

    function removePartner(address _toRemove) external onlyOwner{
        whiteListedPartners[_toRemove]= false;
    }

    function setRelic(address _relic) external onlyOwner {
        RELIC = IRelic(_relic);
    }

    function addWhitelister(address _relicWhitelist) external onlyOwner {
        whitelisters[_relicWhitelist]=true;
    }

    function removeWhitelister(address _relicWhitelist) external onlyOwner {
        whitelisters[_relicWhitelist]=false;
    }

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public onlyOwner {
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public onlyOwner {
        _mintBatch(to, ids, amounts, data);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function setURI(string memory _newUri, uint256 _index) public onlyOwner {
        tokenURIs[_index] = _newUri;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}