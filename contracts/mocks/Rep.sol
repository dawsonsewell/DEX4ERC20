pragma solidity ^0.6.0;

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol';


// this creates a fake Rep token, also known as a mock token
contract Rep is ERC20 {
    constructor() public ERC20("REP", "Augur token")
        {
            uint initialSupply = 1000000000000000000;
            _mint(msg.sender, initialSupply);
        }
}
