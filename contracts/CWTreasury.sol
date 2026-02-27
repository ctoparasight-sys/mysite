// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CWTreasury is Ownable {

    struct Recipient {
        address payable wallet;
        uint16 bps; // basis points out of 10000
    }

    Recipient[] public recipients;

    event Distributed(uint256 total);
    event RecipientsUpdated();

    constructor(address founderWallet) Ownable(founderWallet) {
        // All three slots initially point to founder (investor/ops updated later)
        recipients.push(Recipient(payable(founderWallet), 4500)); // Founder 45%
        recipients.push(Recipient(payable(founderWallet), 4500)); // Investor 45% (placeholder)
        recipients.push(Recipient(payable(founderWallet), 1000)); // Operations 10% (placeholder)
    }

    receive() external payable {}

    function setRecipients(Recipient[] calldata _recipients) external onlyOwner {
        uint16 total;
        for (uint256 i = 0; i < _recipients.length; i++) {
            total += _recipients[i].bps;
        }
        require(total == 10000, "Must sum to 10000 bps");

        delete recipients;
        for (uint256 i = 0; i < _recipients.length; i++) {
            recipients.push(_recipients[i]);
        }
        emit RecipientsUpdated();
    }

    function distribute() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to distribute");

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 share = (balance * recipients[i].bps) / 10000;
            (bool ok, ) = recipients[i].wallet.call{value: share}("");
            require(ok, "Transfer failed");
        }
        emit Distributed(balance);
    }

    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }
}
