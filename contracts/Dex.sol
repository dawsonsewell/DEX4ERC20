pragma solidity 0.6.3;
// the pragma statement below is needed to return the array of a struct using a function --> getOrders()
pragma experimental ABIEncoderV2;

// this repo allows us to use the IERC20 interface within our smart contract
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract Dex {

    // 'using' lets us use a library in Solidity and attach it to a certain type
    // we need to use SafeMath to avoid integer overflow
    // using Safemath will make my code less readable, but in this case is better to prioritze
    // smart contract safety over smart contract readability
    using SafeMath for uint;

    // this will be used to track which orders are buy orders and which orders are sell orders
    enum Side {
        BUY,
        SELL
    }

    // We need to create our own tokens to use on the DEX b/c this will be a test and not deployed on mainnet
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    // Each order placed on the DEX will have the attributes created below
    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint date;
    }


    // mapping of ticker to Token
    mapping(bytes32 => Token) public tokens;
    // map each addresses unique token balances
    mapping(address => mapping(bytes32 => uint)) public traderBalances;
    // we need to create an orderbook for the dex using a mapping to keep track of all the orders
    // we are going to map the ticker (bytes32) to an inner mapping of the order type (Side)
    // we can access the enum using uint's --> 0 = BUY, 1 = SELL to an order array sorted by
    // the best price (high for buy orders and lowest for sell orders)
    // if the orders are the same price, the oldest order is ranked first
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;

    // we need a variable to store the Order id of the next order
    // nextOrderId has a default value of 0
    uint public nextOrderId;

    // public array of all the tokens tradable on the DEX -- contains tocken tickers only
    bytes32[] public tokenList;

    // set administrative address for smart contract
    address public admin;

    // add constant for referencing base currency of the DEX ==> the DAI stable coin
    // adding this as a constant will save us gas b/c it is created when compiled and not computed
    bytes32 constant DAI = bytes32('DAI');

    // we need to create a new variable to increment for our NewTrade event
    uint public nextTradeId;


    // we need a way to emit trades to users. We can do this by creating an event.
    // we used 'indexed' to be able to interact with the data on the front-end of our DEX
    event NewTrade
    (
        uint tradeId,
        uint orderid,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );


    // initialize admin when smart contract is deployed
    constructor() public {
        admin = msg.sender;
    }


    // this will allow certain functions of the smart contract availible to the admin of the smart contract
    modifier onlyAdmin() {
        require
        (
            msg.sender == admin, "Only admin allowed"
        );
        _;
    }

    // we need a modifier that allows only tokens that are real to be deposited or withdrawn.
    // address(0) is the default value of an address in solidity. Any created token is not going to
    // have the default value assigned to it. Any token that is not created will have the default address
    // value automatically created by solidity
    modifier tokenExists(bytes32 ticker) {
        require
        (
            tokens[ticker].tokenAddress != address(0),
            'This token does not exist'
        );
        _;
    }

    // we need to create a modifier for not allowing users to make trades for the DAI stable coin
    // we need to do this for more than one function inside our smart contract
    // so it is good practice to create a modifier to make code easier to understand
    // and more efficient to write
    modifier tokenIsNotDai(bytes32 ticker) {
        require
        (
            ticker != DAI, 'Cannot trade DAI'
        );
        _;
    }

    // the frontend of our DEX will need to be able to get a list of orders from the orderBook[]
    // we can grab that list of orders using the funciton defined below
    function getOrders
        (
        bytes32 ticker,
        Side side
        )
        external
        view
        returns(Order[] memory)
        {
            return orderBook[ticker][uint(side)];
        }

    // we also need a function to get a list of tokens on the dex to the frontend
    // we can grab that token list using the funciton defined below
    function getTokens()
        external
        view
        returns(Token[] memory)
    {
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint i = 0; i < tokenList.length; i++)
        {
            _tokens[i] = Token(
                    tokens[tokenList[i]].ticker,
                    tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
    }

    // function for creating a token
    function addToken
        (
        // function takes two arguements. One for ticker creation, and another for address creation
        bytes32 ticker,
        address tokenAddress
        )
        // only the admin can use this function, and the function can be accessed from the smart contract interface
        onlyAdmin()
        external
        {
            // sets mapping of ticker to a token
            tokens[ticker] = Token(ticker, tokenAddress);
            // adds created token ticker to tokenList array for later use
            tokenList.push(ticker);
        }

    // function takes the amount wanting to be deposited and the ticker of the token being sent
    function deposit
        (
            uint amount,
            bytes32 ticker
        )
        // only tokens created using the addToken function can be deposited or withdrawn
        tokenExists(ticker)
        external
        {
            IERC20(tokens[ticker].tokenAddress)
                .transferFrom(
                    msg.sender,
                    address(this),
                    amount
                    );

            // after the transfer is made to the smart contracts address
            // we need to increment the balance of the trader using SafeMath
            traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].add(amount);
        }

    function withdraw
        (
            uint amount,
            bytes32 ticker
        )
        // only tokens created using the addToken function can be deposited or withdrawn
        tokenExists(ticker)
        external
        {
            // check to see if withdrawer has a depositied balance equal or greater than the amount being withdrawn from the DEX
            require
            (
                traderBalances[msg.sender][ticker] >= amount,
                'balance insufficient'
            );
            // subtract the amount being withdrawn from the ticker amount held by the person withdrawing the token
            traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].sub(amount);

            // Now we perform the transfer
            IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
        }

    // we need to create a funciton so users can place limit orders
    function createLimitOrder
        (
            bytes32 ticker,
            uint amount,
            uint price,
            Side side
        )
        tokenExists(ticker)
        tokenIsNotDai(ticker)
        external
        {
            // We need to check that the trader has enough tokens to make the trade
            if(side == Side.SELL)
                {
                    require
                    (
                        traderBalances[msg.sender][ticker] >= amount,
                        'Token balance too low'
                    );
                } else
                    {
                        require
                        (
                            traderBalances[msg.sender][DAI] >= amount * price,
                            'DAI balance too low'
                        );
                    }
            // now we need to add the order to the orderBook
            Order[] storage orders = orderBook[ticker][uint(side)];
            // then we push the order to the end of the order array
            orders.push(Order(
                nextOrderId,
                msg.sender,
                side,
                ticker,
                amount,
                0, // represents the filled order amount
                price,
                now
                ));

            // now we need to bubble sort the orders to ensure the user gets the best deal on their order
            uint i = orders.length > 0 ? orders.length - 1 : 0; // will selected the second last item in the array
            while(i > 0)
            {
                if(side == Side.BUY && orders[i - 1].price > orders[i].price)
                {
                    break;
                }
                if(side == Side.SELL && orders[i - 1].price < orders[i].price)
                {
                    break;
                }
                // we need to save this value in memory if none of the conditions above trigger
                // the while loop to stop
                Order memory order = orders[i - 1];
                // we need to take the current element in the array and swap it with the previous one
                orders[i - 1] = orders[i];
                // the previous element will be copied into the next element
                orders[i] = order;
                i = i.sub(1);
            }
            // now we need to increment the nextOrderId so the next person placing an order
            // has the correct id when they use the createLimitOrder function
            nextOrderId = nextOrderId.add(1);
        }

    function createMarketOrder
    (
        bytes32 ticker,
        uint amount,
        Side side
    )
    tokenExists(ticker)
    tokenIsNotDai(ticker)
    external
    {
        // if its a sell order we need to make sure the account placing the order
        // has enough of the token to fulfill the sell order
        if(side == Side.SELL)
        {
            require
                (
                    traderBalances[msg.sender][ticker] >= amount,
                    'Token balance too low'
                );
        }
        // We need to extract the relevant SELL or BUY order array from the orderBook[] required
        // to fulfill the market order --> if sell order we need to buy array, and if buy order we need the sell array
        Order[] storage orders = orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)];
        // create a variable we can use to iterate through the orderBook[]
        uint i;
        // We need to set the amount of the order waiting to be filled --> which will initially be the amount of ther order
        uint remaining = amount;

        // Now we can use a while loop to iterate through the orderBook to match order values
        while(i < orders.length && remaining > 0)
        {
            // First we need to grab the availible amount of the order needed to fullfill the order
            // We can do this by subtracting the filled portion of the order from the original amount of the order
            uint available = orders[i].amount.sub(orders[i].filled);

            // Then we calculate the amount that needs to be matched to fullfil the market order
            // if the remaining amount of the order is greater than what is available
            // the first run through of this while loop will always make the matched
            // variable equal to the remaining value b/c none of the order has been filled yet
            uint matched = (remaining > available) ? available : remaining;

            // then we need to decrease remaining by the amount being matched
            remaining = remaining.sub(matched);

            // then we need to alter the orderBook so what just got matched cannot be matched against the order again
            orders[i].filled = orders[i].filled.add(matched);

            // Now we can emit an event giving user information about the trade that took place
            emit NewTrade
            (
                nextTradeId,
                orders[i].id, // this is the msg.sender of the limit order fulfilling the market order
                ticker,
                orders[i].trader, // trader 1 is the trader that created the order in the order book
                msg.sender, // trader 2 is the trader that created the market order
                matched,
                // the price is defined by trader 1 when they created a limit order
                orders[i].price,
                now
            );

            // Now we need to update the balances of the accounts involved in the trade
            // using the matched order values found in the orderBook using the previous while loop
            // i.e matched

            if(side == Side.SELL)
            {
                // the sender of the market order will be decreased by the amount of token traded
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
                    .sub(matched);
                // the trader selling their token will recieve DAI equivalent to the token price and the amount sold
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI]
                    .add(matched.mul(orders[i].price));
                // Now we need to adjust balances of the account fulfilling the market order
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .add(matched);
                // We need to make the trader buying the token pay for their order using dai
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI]
                    .sub(matched.mul(orders[i].price));
            }

            if(side == Side.BUY)
            {
                // it is possible that the buyer does not have enough DAI for their buy order
                // so we need to require that they have enough DAI to fulfill the order
                // and revert the transaction if the buyers DAI balance is not able to fulfill the order
                require
                (
                    traderBalances[msg.sender][DAI] >= matched.mul(orders[i].price),
                    'DAI balance too low'
                );

                // Will be same as above code for set but with tx flows in the opposite direction
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
                    .add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI]
                    .sub(matched.mul(orders[i].price));

                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][ticker]
                    .add(matched.mul(orders[i].price));
            }
            // now we need to increment the nextTradeId to give the next trade a proper id
            nextTradeId = nextTradeId.add(1);
            // And we also need to increment i b/c it's the value we are using to iterate through the orderBook
            i = i.add(1);
        }

        // Now we need to remove orders from the orderBook array that have been filled.
        // if we do not do this the orderBook will continue growing as orders are placed
        // and we be very costly to maintain in storage
        i = 0;
        while(i < orders.length && orders[i].filled == orders[i].amount)
        {
            // we need to use a for loop to iterate through the array with the stopping condition
            // reaching the end of the array
            for(uint j= i; j < orders.length -1; j++)
            {
                // this shifts all the elements in the array
                // --> removing the filled values and placing the unfilled values at the start of the array
                orders[j] = orders[j + 1];
            }
            // the for loop will remove the first value in the array that is filled.
            // and move all other elements 1 index value closer to the start of the array
            // since the array is a certain length, the last element off the array will
            // by default get the value of 0 b/c is will not be set by our smart contract
            // therefor we need to remove this 0 value from the array
            orders.pop();
            // then we need to increment i to continue our while loop for the next value
            i = i.add(1);
        }
    }
}
