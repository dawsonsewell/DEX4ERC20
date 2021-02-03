pragma solidity ^0.6.0;

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol';

// this creates a fake DAI token, also known as a mock token
contract Dai is ERC20 {
    constructor() public ERC20("DAI", "DAI Stable coin")
        {
            uint initialSupply = 1000000000000000000;
            _mint(msg.sender, initialSupply);
        }
}
