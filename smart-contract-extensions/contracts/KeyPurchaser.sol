pragma solidity 0.5.16;

import 'hardlydifficult-ethereum-contracts/contracts/lifecycle/Stoppable.sol';
import '@openzeppelin/upgrades/contracts/Initializable.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import 'unlock-abi-1-3/IPublicLockV6.sol';

/**
 * @notice Purchase a key priced in any ERC-20 token - either once or as a regular subscription.
 * This allows the user to purchase or subscribe to a key with 1 tx (`approve`)
 * or if the token supports it, with 1 signed message (`permit`).
 *
 * The user can remove approval to cancel anytime.
 *
 * Risk: if the user transfers or cancels the key, they would naturally expect that also cancels
 * the subscription but it does not. This should be handled by the frontend.
 */
contract KeyPurchaser is Initializable, Stoppable
{
  using Address for address payable;
  using SafeERC20 for IERC20;

  // set on initialize and cannot change
  IPublicLock public lock;
  uint public maxKeyPrice;
  uint public maxPurchaseCount;
  uint public renewWindow;
  uint public renewMinFrequency;
  bool public isSubscription;

  // admin can change these anytime
  string public name;
  bool internal disabled;

  // store minimal history
  mapping(address => uint) public timeOfLastPurchase;

  /**
   * @notice Called once to set terms that cannot change later on.
   */
  function initialize(
    IPublicLock _lock,
    uint _maxKeyPrice,
    uint _renewWindow,
    uint _renewMinFrequency,
    bool _isSubscription
  ) public
    initializer()
  {
    require(_maxKeyPrice > 0, 'INVALID_MAX_KEYPRICE');
    require(_renewWindow > 0 || !_isSubscription, 'INVALID_RENEW_WINDOW');
    require(_renewMinFrequency > 0 || !_isSubscription, 'INVALID_RENEW_MINFREQUENCY');

    _initializeAdminRole();
    lock = _lock;
    maxKeyPrice = _maxKeyPrice;
    renewWindow = _renewWindow;
    renewMinFrequency = _renewMinFrequency;
    isSubscription = _isSubscription;
    approve();
  }

  /**
   * @notice Approves the lock to spend funds held by this contract.
   * @dev Automatically called on initialize, needs to be called again if the tokenAddress changes.
   * No permissions required, it's okay to call this again.
   */
  function approve() public
  {
    IERC20 token = IERC20(lock.tokenAddress());
    token.safeApprove(address(lock), uint(-1));
  }

  /**
   * @notice Used by admins to update metadata which may be leveraged by the frontend.
   */
  function config(
    string memory _name,
    bool _disabled
  ) public
    onlyAdmin()
  {
    name = _name;
    disabled = _disabled;
  }

  /**
   * @notice Indicates if this purchaser should be exposed as an option to users on the frontend.
   * False does not necessarily mean previous subs will no longer work (see `stopped` for that).
   */
  function isActive() public view returns(bool)
  {
    return !stopped() && !disabled;
  }

  /**
   * @notice Called by anyone to purchase or renew a key on behalf of a user.
   * The user must have ERC-20 spending approved and the purchase must meet the terms
   * defined during initialization.
   */
  function purchaseFor(
    address payable _user,
    address _referrer,
    bytes memory _data
  ) public
    whenNotStopped()
  {
    uint temp = timeOfLastPurchase[_user];
    require(isSubscription || temp == 0, 'SINGLE_USE_ONLY');
    // `now` must be strictly larger than the timestamp of the last block
    require(now - temp >= renewMinFrequency, 'BEFORE_MIN_FREQUENCY');

    if(lock.getHasValidKey(_user))
    {
      temp = lock.keyExpirationTimestampFor(_user); // This reverts if getHasValidKey is false
      require(temp <= now || temp - now <= renewWindow, 'OUTSIDE_RENEW_WINDOW');
    }

    temp = lock.keyPrice();
    if(temp > 0)
    {
      require(temp <= maxKeyPrice, 'PRICE_TOO_HIGH');

      // It's okay if the lock changes tokenAddress as the ERC-20 approval is specifically
      // the token the endUser wanted to spend
      IERC20 token = IERC20(lock.tokenAddress());
      // We don't need safeTransfer as if these do not work the purchase will fail
      token.transferFrom(_user, address(this), temp);
      // approve is already complete
    }

    lock.purchase(temp, _user, _referrer, _data);
    timeOfLastPurchase[_user] = now;

    // RE events: it's not clear emitting an event adds value over the ones from purchase and the token

    // During normal use there will be no balance remaining in the contract
    // But just in case of a new feature in Locks.
    // Testing shows the balance checks for this costs 1478 gas - very cheap.

    // Refund ETH
    temp = address(this).balance;
    if(temp > 0)
    {
      msg.sender.sendValue(temp);
    }

    // Refund tokens
    temp = token.balanceOf(address(this));
    if(temp > 0)
    {
      token.safeTransfer(msg.sender, temp);
    }
  }
}
