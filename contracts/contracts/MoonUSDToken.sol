// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MoonUSDToken is ERC20, Ownable {
    error MoonUSDToken__NotMinter();
    error MoonUSDToken__ZeroAddress();

    address public minter;

    event MinterUpdated(address indexed newMinter);

    constructor(address initialOwner) ERC20("MoonUSD", "MUSD") Ownable(initialOwner) {}

    modifier onlyMinter() {
        if (msg.sender != minter) {
            revert MoonUSDToken__NotMinter();
        }
        _;
    }

    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) {
            revert MoonUSDToken__ZeroAddress();
        }

        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
    }
}
