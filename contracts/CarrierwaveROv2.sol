// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CarrierwaveROv2 is ERC721, Ownable {

    uint256 private _tokenIdCounter;
    bool public mintingPaused;
    string public baseURI;

    uint256 public mintFee;
    address payable public treasury;

    struct RORecord {
        string  roId;
        string  contentHash;
        address submitter;
        uint256 mintedAt;
    }

    mapping(uint256 => RORecord) public roRecords;
    mapping(string => bool) public contentHashMinted;
    mapping(string => uint256) public roIdToTokenId;

    event ROMinted(
        uint256 indexed tokenId,
        address indexed submitter,
        string roId,
        string contentHash
    );

    constructor(
        address founderWallet,
        address payable _treasury,
        uint256 _mintFee
    )
        ERC721("Carrierwave Research Object", "CWRO")
        Ownable(founderWallet)
    {
        baseURI = "https://carrierwave.org/ro/";
        treasury = _treasury;
        mintFee = _mintFee;
    }

    function mintRO(
        string calldata roId,
        string calldata contentHash
    ) external payable returns (uint256) {
        require(!mintingPaused, "Minting is paused");
        require(bytes(roId).length > 0, "roId required");
        require(bytes(contentHash).length > 0, "contentHash required");
        require(!contentHashMinted[contentHash], "Already minted");
        require(roIdToTokenId[roId] == 0, "RO already minted");
        require(msg.value >= mintFee, "Insufficient fee");

        uint256 tokenId = ++_tokenIdCounter;

        _safeMint(msg.sender, tokenId);

        roRecords[tokenId] = RORecord({
            roId:        roId,
            contentHash: contentHash,
            submitter:   msg.sender,
            mintedAt:    block.timestamp
        });

        contentHashMinted[contentHash] = true;
        roIdToTokenId[roId] = tokenId;

        // Forward full msg.value to treasury
        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "Treasury transfer failed");

        emit ROMinted(tokenId, msg.sender, roId, contentHash);

        return tokenId;
    }

    function tokenURI(uint256 tokenId)
        public view override returns (string memory)
    {
        _requireOwned(tokenId);
        return string(abi.encodePacked(baseURI, roRecords[tokenId].roId));
    }

    function getRecord(uint256 tokenId)
        external view returns (RORecord memory)
    {
        _requireOwned(tokenId);
        return roRecords[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function setMintingPaused(bool paused) external onlyOwner {
        mintingPaused = paused;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function setMintFee(uint256 newFee) external onlyOwner {
        mintFee = newFee;
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        treasury = newTreasury;
    }
}
