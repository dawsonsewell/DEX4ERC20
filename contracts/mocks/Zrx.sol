pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


// this creates a fake Zrx token, also known as a mock token
contract Zrx is ERC20 {
    constructor() public ERC20("ZRX", "0x token")
        {
            uint initialSupply = 1000000000000000000;
            _mint(msg.sender, initialSupply);
        }
}
