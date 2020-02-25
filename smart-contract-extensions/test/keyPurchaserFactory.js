const { protocols, tokens } = require('hardlydifficult-ethereum-contracts')

const KeyPurchaserFactory = artifacts.require('KeyPurchaserFactory.sol')
const KeyPurchaser = artifacts.require('KeyPurchaser.sol')
const { reverts } = require('truffle-assertions')

contract('keyPurchaserFactory', accounts => {
  const [endUser, lockCreator, tokenMinter, otherAccount] = accounts
  let dai
  let lock
  let factory
  // Since dai also uses 18 decimals, this represents 1 DAI
  const keyPrice = web3.utils.toWei('1', 'ether')

  beforeEach(async () => {
    dai = await tokens.dai.deploy(web3, tokenMinter)
    await dai.mint(endUser, web3.utils.toWei('100', 'ether'), {
      from: tokenMinter,
    })
    // Anyone could deploy the factory, and then front ends can integrate with one they trust.
    factory = await KeyPurchaserFactory.new()

    // Create a Lock priced in DAI
    lock = await protocols.unlock.createTestLock(web3, {
      tokenAddress: dai.address,
      keyPrice,
      expirationDuration: 30, // 30 seconds
      from: lockCreator,
    })
  })

  it('non-lock manager cannot make a purchaser via the factory', async () => {
    await reverts(
      factory.deployKeyPurchaser(lock.address, keyPrice, 42, 99, true, {
        from: otherAccount,
      }),
      'ONLY_LOCK_OWNER'
    )
  })

  describe('on creation', () => {
    let purchaser

    beforeEach(async () => {
      const tx = await factory.deployKeyPurchaser(
        lock.address,
        keyPrice,
        42,
        99,
        true,
        {
          from: lockCreator,
        }
      )
      purchaser = await KeyPurchaser.at(tx.receipt.logs[0].args.keyPurchaser)
    })

    it('purchaser created with the correct settings', async () => {
      const maxKeyPrice = await purchaser.maxKeyPrice()
      const renewWindow = await purchaser.renewWindow()
      const renewMinFrequency = await purchaser.renewMinFrequency()
      const isSubscription = await purchaser.isSubscription()
      assert.equal(maxKeyPrice, keyPrice)
      assert.equal(renewWindow, 42)
      assert.equal(renewMinFrequency, 99)
      assert.equal(isSubscription, true)
    })

    it('can read the purchaser address from the factory', async () => {
      const purchasers = await factory.getKeyPurchasers(lock.address)
      assert.equal(purchasers.length, 1)
      assert.equal(purchasers[0], purchaser.address)
    })

    describe('with many options', () => {
      // We can read options even if there's 1k options for a single lock
      // But lowering the test to 100 to save CI time
      const purchaserCount = 100

      beforeEach(async () => {
        for (let i = 0; i < purchaserCount - 1; i++) {
          await factory.deployKeyPurchaser(
            lock.address,
            keyPrice,
            42,
            99,
            true,
            {
              from: lockCreator,
            }
          )
        }
      })

      it('can read the purchasers', async () => {
        const purchasers = await factory.getKeyPurchasers(lock.address)
        assert.equal(purchasers.length, purchaserCount)
        assert.equal(purchasers[0], purchaser.address) // sanity check
      })
    })
  })
})
