//                                       @@@
//                                       @@@
//                                       @@@
//                                       @@@
//                                       @@@
//                                       @@@
//                                       @@@
//               @@@                    @@@@@                    @@@
//               @@@                  @@@@@@@@@                  @@@
//               @@@               .@@@@@@@@@@@@@.               @@@
//               @@@             (@@@@@@@@@@@@@@@@@)             @@@
//               @@@           @@@@@@@@@@@@@@@@@@@@@@@           @@@
//               @@@         @@@@@@@@@@@@@@@@@@@@@@@@@@@         @@@
//               @@@       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@       @@@
//               @@@    .@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.    @@@
//               @@@  /@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\  @@@
//               @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//               @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IRelic {
    function whitelistTemplar(address _toWhitelist) external;
}

contract TempleSacrifice is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IRelic public RELIC;
    IERC20 public TEMPLE;
    uint256 private originTime;
    uint256 public customPrice;

    function sacrifice() external nonReentrant {
        uint256 allowance = TEMPLE.allowance(msg.sender, address(this));
        require(allowance >= getPrice(), "Check $TEMPLE allowance");
        TEMPLE.safeTransferFrom(msg.sender, 0x000000000000000000000000000000000000dEaD, getPrice());
        RELIC.whitelistTemplar(msg.sender);
    }

    function getPrice() public view returns (uint256) {
        uint256 price = customPrice != 0
            ? customPrice
            : (10 *
                10**18 +
                (40 *
                    10**18 *
                    (((((block.timestamp - originTime) / 60 / 60 / 24) * 100) /
                        365) * 100)) /
                10000);
        if (price > 50 * 10**18) price = 50 * 10**18;
        return price;
    }

    function setAddresses(address _relic, address _temple) external onlyOwner {
        RELIC = IRelic(_relic);
        TEMPLE = IERC20(_temple);
    }

    function setOriginTime(uint256 _time) external onlyOwner {
        originTime = _time;
    }

    function setCustomPrice(uint256 _price) external onlyOwner {
        customPrice = _price;
    }
}
