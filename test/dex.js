const { expectRevert } = require('@openzeppelin/test-helpers');

// first we are going to import our mock ERC20 tokens
const Dai = artifacts.require('mocks/Dai.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Dex = artifacts.require('Dex.sol');

// we need to extract the addresses from our local deveopment blockchain --> accounts

contract('Dex', (accounts) => {
  let dai, bat, rep, zrx, dex;
  // we extract two account addresses specifically for testing use
  // we will not use accounts[0] b/c that is the admin of the dex
  // we want to separate the admin completely for testing other parts
  const [trader1, trader2] = [accounts[1], accounts[2]];
  // we need to grab and set each ticker for use in our testing
  // and use it to create our token using the addToken function
  // of our smart contract
  const [DAI, BAT, REP, ZRX] = ['DAI', 'BAT', 'REP', 'ZRX']
    .map(ticker => web3.utils.fromAscii(ticker));

  // we need to deploy each token using a beforeEach hook that will run
  // before each test

  beforeEach(async() => {
    // this will deploy a contract array of all contract instances
    // that will allow us to interact with our mock ERC20 tokens
    // using dai, bat, rep, and zrx
    ([dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new()
    ]));
    // after our ERC20 tokens are deoployed we need to deploy our DEX
    dex = await Dex.new();
    // now we need to add each token to our dex using its addToken function
    // and web3
    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address)
    ]);
    // We need to allocate the amount of tokens for trader1 and trader2
    const amount = web3.utils.toWei('1000');
    // now we need to give the allocated amount to each address
    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount);
      // we need to create functionality for traders to deposit
      // their tokens easily on the dex later
      await token.approve(
        dex.address,
        amount,
        {from: trader}
      );
    };
    // now we need to loop through all our tokens and call the
    // seedTokenBalance function for each trader
    await Promise.all(
      [dai, bat, rep, zrx].map(
        token => seedTokenBalance(token, trader1)
      )
    );

    await Promise.all(
      [dai, bat, rep, zrx].map(
        token => seedTokenBalance(token, trader2)
      )
    );
  });

  // testing deposit function
  // deposit function takes amount and ticker into it -- happy path
  it('Should deposit tokens', async() => {
    // define the amount of token we want to deposit
    const amount = web3.utils.toWei('100');

    // make deposit using the deposit function from trader1's account
    await dex.deposit(
      amount,
      DAI,
      {from: trader1}
    );

    // now we get the DAI balance of trader1
    const balance = await dex.traderBalances(trader1, DAI);

    // now we need to assert than the amount deposited
    // is equal to the balance of trader1
    // Note: trader1 has 1000 wei associated with their address -- see seedTokenBalance
    assert(balance.toString() === amount);
  });

  // deposit function takes amount and ticker into it -- Unhappy path
  it('Should NOT deposit tokens if token does not exist', async() => {
    await expectRevert(
      dex.deposit(
        web3.utils.toWei('100'),
        web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
        {from: trader1}
      ),
      'This token does not exist' // this is the expected error message
    );
  });
});
