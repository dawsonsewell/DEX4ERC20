pragma solidity ^0.6.3;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


// this creates a fake Zrx token, also known as a mock token
contract Zrx is ERC20 {
    constructor() ERC20("0x token", "ZRX") public {}

    function faucet(address to, uint amount) external {
      _mint(to, amount);
    }
}
