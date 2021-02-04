pragma solidity ^0.6.3;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


// this creates a fake DAI token, also known as a mock token
contract Bat is ERC20 {
    constructor() ERC20("Brave browser token", "BAT") public {}

    function faucet(address to, uint amount) external {
      _mint(to, amount);
    }
} 
