pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


// this creates a fake DAI token, also known as a mock token
contract Bat is ERC20 {
    constructor() public ERC20("BAT", "Brave browser token")
        {
            uint initialSupply = 1000000000000000000;
            _mint(msg.sender, initialSupply);
        }
}
