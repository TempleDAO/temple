pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

interface IShards {
    function equipShard(address _ownerAdress, uint256[] memory _itemIds, uint256[] memory _amounts) external;
    function unEquipShard(address _target, uint256[] memory _itemIds, uint256[] memory _amounts) external;
    function burnFromRelic(uint256 _itemId, uint256 _amount) external;
    function mintFromRelic(uint256 _itemId, uint256 _amount) external; 
}

contract Relic is ERC721, ERC721Enumerable, ERC721URIStorage, Pausable, Ownable, ERC721Burnable,IERC1155Receiver, ReentrancyGuard  {
    constructor() ERC721("Relic", "RELIC") {}
    using Strings for uint256;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    enum Enclave{ Logic, Structure, Order, Mystery, Chaos}
    mapping (uint256 => Enclave) enclaves;
    enum Rarity{ Common, Uncommon, Rare, Epic, Legendary}
    mapping (address => bool) private whitelisted;
    mapping (address => bool) private whitelistedContracts;
    mapping (uint256 => mapping(uint256 => uint256)) private balances;
    mapping(uint256 => uint256) private relicXP;

    mapping (Enclave => mapping (Rarity => string)) private BASE_URIS;
    IShards private SHARDS;
    address private experienceProvider;
    address private whitelisterAddress;
    uint256[] private thresholds;


    //------- External -------//

    // TODO: CHECK WHITELISTING SYSTEM FOR RELICS !!!
    function mintRelic (Enclave _selectedEnclave) external nonReentrant {
        // DEACTIVATED FOR TESTING
        require(whitelisted[msg.sender], "You cannot own a Relic yet");
         uint256 tokenId = _tokenIdCounter.current();
        enclaves[tokenId] = _selectedEnclave;
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);

        //remove whitelist
        whitelisted[msg.sender]=false;
    }

    function renounceRelic(uint256 _relicId) external nonReentrant  {
        require(ownerOf(_relicId)==msg.sender);
        super._burn(_relicId);
    }

    // @dev Templar equips his Shard into his Relic
    function batchEquipShard(uint256 _targetRelic, uint256[] memory _itemIds, uint256[] memory _amounts) external nonReentrant {
        require(msg.sender == ownerOf(_targetRelic), "You don't own this Relic");

        // transfer them to the Relic
        SHARDS.equipShard(msg.sender,_itemIds, _amounts);
        // update balances
        for(uint i=0; i<_itemIds.length;i++){
            balances[_targetRelic][_itemIds[i]]+= _amounts[i];
        }
    }


    function batchUnequipShard(uint256 _targetRelic, uint256[] memory _itemIds, uint256[] memory _amounts) external nonReentrant {
        require(msg.sender == ownerOf(_targetRelic), "You don't own this Relic");

        // transfer to sender
        SHARDS.unEquipShard(msg.sender, _itemIds, _amounts);
        // update balances
        for(uint i=0; i<_itemIds.length;i++){
            balances[_targetRelic][_itemIds[i]]-= _amounts[i];
        }
    }

    // alows whitelisted contract to mint to an address
    function mintFromContract(address _to, Enclave _selectedEnclave) external {
        require(whitelistedContracts[msg.sender], "This contract is not authorised to mint");
         uint256 tokenId = _tokenIdCounter.current();
         enclaves[tokenId] = _selectedEnclave;
        _tokenIdCounter.increment();
        _safeMint(_to,tokenId);
    }

    // external temple contract whitelisting for Relic minting
    function whitelistTemplar(address _toWhitelist) external {
        require(msg.sender == whitelisterAddress, "Not authorised");
        whitelisted[_toWhitelist] = true;
    }

    // FOR TEST
    function givePoints(uint256 _amount, uint256 _relicId)external {
        require(msg.sender == whitelisterAddress, "Not authorised");
        relicXP[_relicId]+=_amount;
    }

    //------- Public -------//

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(IERC165, ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function getRelicXP(uint256 _relicId) public view returns (uint256){
        require(_exists(_relicId), "This Relic doesn't exist");
        return relicXP[_relicId];
    }

    function tokenURI(uint256 _relicId)
        public
        view
        virtual
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        require(_exists(_relicId));



        return
            string(
                abi.encodePacked(BASE_URIS[enclaves[_relicId]][_getRarity(_relicId)], _relicId.toString())
            );
    }

    function getBalance(uint256 _relicId, uint256 _tokenId) external view returns(uint256){
        require(_exists(_relicId),"This Relic doesn't exist.");
        return balances[_relicId][_tokenId];
    }

    function getBalanceBatch(uint256 _relicId, uint256[] memory _tokenId) external view returns(uint256[] memory){
        require(_exists(_relicId),"This Relic doesn't exist.");

        uint256[] memory balancesToReturn = new uint256[](_tokenId.length);
        for(uint i=0;i<_tokenId.length;i++){
            balancesToReturn[i]=  balances[_relicId][_tokenId[i]];
        }

        return balancesToReturn;
    }

    // fetch Rarity and Enclave from a single Relic
    function getRelicInfos(uint256 _relicId) external view returns (Rarity, Enclave){
        return (_getRarity(_relicId), enclaves[_relicId]);
    }
   
    //------- Internal -------//

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        
    }

    function _getRarity(uint256 _relicId) internal view returns(Rarity currRarity){
        for(uint i = 0 ; i<4;i++){
            if(relicXP[_relicId]<thresholds[i]){
                return Rarity(i);
            }
        }
        return Rarity(4);
    }


     //------- Owner -------//

    

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }
    
    function setThresholds(uint256[] memory _newThresholds) external onlyOwner {
        thresholds = _newThresholds;
    }

    function removeFromWhitelist(address _toRemove) external onlyOwner{
        whitelisted[_toRemove] = false;
    }

    function setShardContract(address _shardsContract) external onlyOwner{
        SHARDS = IShards(_shardsContract);
    }

    function setXPProvider(address _xpProvider) external onlyOwner{
        experienceProvider = _xpProvider;
    }

    function setTempleWhitelister(address _whiteliser) external onlyOwner{
        whitelisterAddress = _whiteliser;
    }

    function setBaseURI(string[] memory _newBaseURIs) public onlyOwner {
        uint256 counter =0;
        for(uint e=0;e<5;e++){
            for(uint r=0;r<5;r++){
                BASE_URIS[Enclave(e)][Rarity(r)]=_newBaseURIs[counter];
                counter++;
            }
        }
    }

}