//                  / /\
//                 / /  \
//                / / /\ \
//               / / /\ \ \
//              / / /  \ \ \
//             / / /    \ \ \
//            / / /      \ \ \
//           / / /        \ \ \
//          / / /          \ \ \
//         / / /   _   _    \ \ \
//        / / /\  /\ \/ /\  /\ \ \
//      .`.`.`\ \ \ \/ / / / /`.`.`.
//    .`.`.` \ \ \ \/ / / / / / `.`.`.
//  .`.`.`    \ \ \/ / /\/ / /    `.`.`.
//.`.`.`       \ \ \/ /\/ / /       `.`.`.
//`.`.`.        \_\  /\  /_/        .`.`.`
//  `.`.`.      / /  \/  \ \      .`.`.`
//    `.`.`.   / / /\ \/\ \ \   .`.`.`
//      `.`.`./ / /\ \ \/\ \ \.`.`.`
//        \ \ \/ / /\ \ \ \ \/ / /
//         \ \ \/ /_/\ \ \ \/ / /
//          \ \ \ \_\/\_\/ / / /
//           \ \ \        / / /
//            \ \ \      / / /
//             \ \ \    / / /
//              \ \ \  / / /
//               \ \ \/ / /
//                \ \ \/ /
//                 \ \  /
//                  \_\/
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

interface IItems {
    function equipItems(address _ownerAdress, uint256[] memory _itemIds, uint256[] memory _amounts) external;
    function unEquipItems(address _target, uint256[] memory _itemIds, uint256[] memory _amounts) external;
    function burnFromRelic(uint256 _itemId, uint256 _amount) external;
    function mintFromRelic(uint256 _itemId, uint256 _amount) external; 
}

contract Relic is ERC721, ERC721Enumerable, ERC721URIStorage, Pausable, Ownable, ERC721Burnable,IERC1155Receiver, ReentrancyGuard  {
    constructor() ERC721("Relic", "RELIC") {}
    using Strings for uint256;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // @dev Relic mint whitelist
    mapping (address => bool) public whitelisted;
    // Contracts authorised to mint
    mapping (address => bool) public whitelistedContracts;
    // @dev Relic content: RelicId => ItemId => Balance
    mapping (uint256 => mapping(uint256 => uint256)) public balances;
    // @dev Recipes
    mapping(uint256 => Recipe) public recipes;
    // @dev Relic Experience Points
    mapping(uint256 => uint256) public relicXP;

    string public BASE_URI;
    // @dev RelicItems.sol
    IItems private ITEMS;
    // @dev Contract providing experience points to Relics
    address private experienceProvider;
    // whitelister address
    address private whitelisterAddress;

    struct Recipe {
        uint16 id;
        uint256[] requiredIds;
        uint256[] requiredAmounts;
        uint256[] rewardIds;
        uint256[] rewardAmounts;
    }

    event Transmutation(address Templar, uint256 recipeId);

    //------- External -------//

    // TODO: CHECK WHITELISTING SYSTEM FOR RELICS !!!
    function mintRelic () external nonReentrant {
        // DEACTIVATED FOR TESTING
        // require(whitelisted[msg.sender], "You cannot own a Relic yet");
         uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);

        //remove whitelist
        whitelisted[msg.sender]=false;
    }

    function renounceRelic(uint256 _relicId) external nonReentrant  {
        require(ownerOf(_relicId)==msg.sender);
        super._burn(_relicId);
    }

    // @dev Templar equips his items into his Relic
    function batchEquipItems(uint256 _targetRelic, uint256[] memory _itemIds, uint256[] memory _amounts) external nonReentrant {
        require(msg.sender == ownerOf(_targetRelic), "You don't own this Relic");

        // transfer them to the Relic
        ITEMS.equipItems(msg.sender,_itemIds, _amounts);
        // update balances
        for(uint i=0; i<_itemIds.length;i++){
            balances[_targetRelic][_itemIds[i]]+= _amounts[i];
        }
    }


    function batchUnequipItems(uint256 _targetRelic, uint256[] memory _itemIds, uint256[] memory _amounts) external nonReentrant {
        require(msg.sender == ownerOf(_targetRelic), "You don't own this Relic");

        // transfer to sender
        ITEMS.unEquipItems(msg.sender, _itemIds, _amounts);
        // update balances
        for(uint i=0; i<_itemIds.length;i++){
            balances[_targetRelic][_itemIds[i]]-= _amounts[i];
        }
    }

     // use receipes to transform ingredients into a new item
    function transmute(uint256 _relicId, uint256 _recipeId)
        external
        nonReentrant
    {

        Recipe memory transmutation = recipes[_recipeId];
        // Destroy
        for (uint256 i = 0; i < transmutation.requiredIds.length; i++) {
            require(
                balances[_relicId][transmutation.requiredIds[i]] >=
                    transmutation.requiredAmounts[i],
                "Not enough ingredients"
            );
            _burnItem(
                _relicId,
                transmutation.requiredIds[i],
                transmutation.requiredAmounts[i]
            );
        }
        // Create
        for (uint256 i = 0; i < transmutation.rewardIds.length; i++) {
            _mintItem(
                _relicId,
                transmutation.rewardIds[i],
                transmutation.rewardAmounts[i]
            );
        }

        emit Transmutation(msg.sender, _recipeId);
    }

    // alows whitelisted contract to mint to
    function mintFromContract(address _to) external {
        require(whitelistedContracts[msg.sender], "This contract is not authorised to mint");
         uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(_to,tokenId);
    }

    function whitelistTemplar(address _toWhitelist) external {
        require(msg.sender == whitelisterAddress, "Not authorised");
        whitelisted[_toWhitelist] = true;
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
                abi.encodePacked(BASE_URI, _relicId.toString())
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

    function _mintItem(uint256 _relicId, uint256 _itemId, uint256 _amount) internal {
        // mint on 1155 and send to Relic contract
        ITEMS.mintFromRelic(_itemId, _amount);
        // increase balance
        balances[_relicId][_itemId]+=_amount;
    }

    function _burnItem(uint256 _relicId, uint256 _itemId, uint256 _amount) internal{
        // burn on 1155
        ITEMS.burnFromRelic(_itemId, _amount);
        // remove balance
        balances[_relicId][_itemId]-=_amount;
    }


     //------- Owner -------//

    function createRecipe(
        uint256 _recipeId,
        uint256[] memory _requiredIds,
        uint256[] memory _requiredAmounts,
        uint256[] memory _rewardIds,
        uint256[] memory _rewardAmounts
    ) external onlyOwner {
        recipes[_recipeId].id = uint16(_recipeId);
        recipes[_recipeId].requiredIds = _requiredIds;
        recipes[_recipeId].requiredAmounts = _requiredAmounts;
        recipes[_recipeId].rewardIds = _rewardIds;
        recipes[_recipeId].rewardAmounts = _rewardAmounts;
    }

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
    
 

    function removeFromWhitelist(address _toRemove) external onlyOwner{
        whitelisted[_toRemove] = false;
    }

    function setItemContract(address _itemContract) external onlyOwner{
        ITEMS = IItems(_itemContract);
    }

    function setXPProvider(address _xpProvider) external onlyOwner{
        experienceProvider = _xpProvider;
    }

    function setTempleWhitelister(address _whiteliser) external onlyOwner{
        whitelisterAddress = _whiteliser;
    }

    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        BASE_URI = _newBaseURI;
    }

}