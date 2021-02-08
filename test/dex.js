const { expectRevert } = require('@openzeppelin/test-helpers');

// first we are going to import our mock ERC20 tokens
const Dai = artifacts.require('mocks/Dai.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Dex = artifacts.require('Dex.sol');

const SIDE = {
  BUY: 0,
  SELL: 1
};

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

  // test for withdraw funciton -- happy path, and two unhappy paths
  it('Funds should have been withdrawn', async() => {
    const amount = web3.utils.toWei('100');

    await dex.deposit(
      amount,
      DAI,
      {from: trader1}
    );

    await dex.withdraw(
      amount,
      DAI,
      {from: trader1}
    );

    const [balanceDex, balanceDai] = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dai.balanceOf(trader1)
    ]);

    assert(balanceDex.isZero());
    assert(balanceDai.toString() === web3.utils.toWei('1000'));

  });

  it('Should not withdraw tokens that do not exist', async() => {
    await expectRevert(
      dex.withdraw(
        web3.utils.toWei('100'),
        web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
        {from: trader1}
      ),
      'This token does not exist' // this is the expected error message
    );
  });

  it('Should not withdraw if balance is too low', async() => {
    const amount = web3.utils.toWei('100');

    await dex.deposit(
      amount,
      DAI,
      {from: trader1}
    );

    await expectRevert(
      dex.withdraw(
        web3.utils.toWei('1000'),
        DAI,
        {from: trader1}
      ),
      'balance insufficient'
    );
  });

  // We are going to create 5 tests for testing our createLimitOrder function
  // the first test will be the happy path and the rest are unhappy paths
  it('Should create limit order', async() => {
    const amount = web3.utils.toWei('100');

    await dex.deposit(
      amount,
      DAI,
      {from: trader1}
    );

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      10,
      SIDE.BUY,
      {from: trader1}
    );

    // we use let to set the variable so we can redefine it
    // later in the testing process
    let buyOrders = await dex.getOrders(REP, SIDE.BUY);
    let sellOrders = await dex.getOrders(REP, SIDE.SELL);

    // now we need to check the expected values
    assert(buyOrders.length === 1);
    assert(buyOrders[0].trader === trader1);
    // we need to pad what we get back from the smart contract with
    // a zero to the right for the below assertion to work with
    // a bytes32 value
    assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));
    assert(buyOrders[0].price === '10');
    assert(buyOrders[0].amount === web3.utils.toWei('10'));
    // we also need to check that we do not have a sell order b/c
    // we did not create one yet
    assert(sellOrders.length === 0);

    // Now that we know if we create a limit order everything checks out,
    // but what happens if we create another limit order?
    // does everything still checkout?
    await dex.deposit(
      web3.utils.toWei('200'),
      DAI,
      {from: trader2}
    );

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      11,
      SIDE.BUY,
      {from: trader2}
    );

    buyOrders = await dex.getOrders(REP, SIDE.BUY);
    sellOrders = await dex.getOrders(REP, SIDE.SELL);
    assert(buyOrders.length === 2);
    // trader2 should be the first order b/c our function
    // bubble sorts the orders so the best price is always
    // at position 0 in the array (i.e the first item in the array)
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);
    assert(buyOrders[0].price === '11');
    assert(sellOrders.length === 0);

    // now we are going to create another limit order but
    // with a price that is lower than the first two and check
    // to see if this order is in the correct place
    // the limit order should work b/c trader2 should have 90 wei left to
    // make a buy order with
    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      9,
      SIDE.BUY,
      {from: trader2}
    );

    buyOrders = await dex.getOrders(REP, SIDE.BUY);
    sellOrders = await dex.getOrders(REP, SIDE.SELL);

    assert(buyOrders.length === 3);
    // trader2 should be the first order b/c our function
    // bubble sorts the orders so the best price is always
    // at position 0 in the array (i.e the first item in the array)
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);
    assert(buyOrders[2].trader === trader2);
    assert(buyOrders[2].price === '9');
    assert(sellOrders.length === 0);
  });

  // this test will test the unhappy path of the createLimitOrder function
  // using a token that does not exist
  it('Should NOT create limit order if token does not exist', async() => {
    // testing using a token that does not exist
    await expectRevert(
      dex.createLimitOrder(
        web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
        web3.utils.toWei('1000'),
        10,
        SIDE.BUY,
        {from:trader1}
      ),
      // error message from tokenExists modifier
      'This token does not exist'
    );
  });

  // this test will test the unhappy path of the createLimitOrder function
  // using a DAI to trigger the tokenIsNotDai modifier
  it('Should NOT create limit order if token is DAI', async() => {
    // testing using a token that does not exist
    await expectRevert(
      dex.createLimitOrder(
        DAI,
        web3.utils.toWei('1000'),
        10,
        SIDE.BUY,
        {from:trader1}
      ),
      // error message from tokenIsNotDai modifier
      'Cannot trade DAI'
    );
  });

  // test for creating a sell limit order token balance being too low
  it('Cannot create sell limit order if token deposited token balance is too low.', async() => {

    await dex.deposit(
      web3.utils.toWei('99'),
      REP,
      {from: trader1}
    );

    await expectRevert(
      dex.createLimitOrder(
        REP,
        web3.utils.toWei('100'),
        10,
        SIDE.SELL,
        {from: trader1}
      ),
      'Token balance too low'
    );
  });

  // test for creating a buy limit order without enough DAI
  it('Cannot create buy limit order if deposited DAI balance is too low', async() => {

    await dex.deposit(
      web3.utils.toWei('99'),
      DAI,
      {from: trader1}
    );

    await expectRevert(
      dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        {from: trader1}
      ),
      'DAI balance too low'
    );
  });

  // now we will test 4 unhappy paths and one happy path
  // of the createMarketOrder funciton

  it('Should create market order and match existing marketorder', async() => {
    // first we need to deposit and create a limit order
    await dex.deposit(
      web3.utils.toWei('100'),
      DAI,
      {from: trader1}
    );

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      10,
      SIDE.BUY,
      {from: trader1}
    );

    // Now we need to create the matching market order
    await dex.deposit(
      web3.utils.toWei('100'),
      REP,
      {from: trader2}
    );

    await dex.createMarketOrder(
      REP,
      web3.utils.toWei('5'),
      SIDE.SELL,
      {from: trader2}
    );

    // now we need to check if the market order was matched to the limit order
    // by checking all balances
    const balances = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dex.traderBalances(trader1, REP),
      dex.traderBalances(trader2, DAI),
      dex.traderBalances(trader2, REP)
    ]);

    // we also want to check the orderBook to see that the limit order
    // has been partially filled
    const orders = await dex.getOrders(REP, SIDE.BUY);

    // now that we have these values we can begin making assertions
    assert(orders[0].filled === web3.utils.toWei('5')); // this is filled with the REP token from trader2
    assert(balances[0].toString() === web3.utils.toWei('50')); // traders one bought 5 REP from trader2 for 10 DAI each
    assert(balances[1].toString() === web3.utils.toWei('5')); // this is the amount of REP token now owned by trader1
    assert(balances[2].toString() === web3.utils.toWei('50')); // trader2 now owns the 50 DAI earned by selling their 5 REP token for 10 wei each
    assert(balances[3].toString() === web3.utils.toWei('95')); // trader2 only has 95 REP token left b/c they sold 5 of them
  });

  it('Should not create market order for tokens that do not exist', async() => {
    await expectRevert(
      dex.createMarketOrder(
        web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
        web3.utils.toWei('1000'),
        SIDE.BUY,
        {from:trader1}
      ),
      // error message from tokenExists modifier
      'This token does not exist'
    );
  });

  it('Should not create market order if token is DAI', async() => {
    await expectRevert(
      dex.createMarketOrder(
        DAI,
        web3.utils.toWei('1000'),
        SIDE.BUY,
        {from:trader1}
      ),
      // error message from tokenIsNotDai modifier
      'Cannot trade DAI'
    );
  });

  it('Should not create market order if token balance is too low', async() => {
    await dex.deposit(
      web3.utils.toWei('99'),
      REP,
      {from: trader1}
    );

    await expectRevert(
      dex.createMarketOrder(
        REP,
        web3.utils.toWei('100'), // trader1 cannot sell 100 REP tokens b/c they only have 99 deposited
        SIDE.SELL,
        {from: trader1}
      ),
      'Token balance too low'
    );
  });

  it('Should not create market order if DAI balance is too low', async() => {
    await dex.deposit(
      web3.utils.toWei('100'),
      REP,
      {from: trader1}
    );

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('100'),
      10,
      SIDE.SELL,
      {from: trader1}
    );

    await expectRevert(
      dex.createMarketOrder(
        REP,
        web3.utils.toWei('100'), // trader2 cannot buy 100 REP tokens b/c they have not deposited any DAI or do not have enough DAI deposited 
        SIDE.BUY,
        {from: trader2}
      ),
      'DAI balance too low'
    );
  });

});
