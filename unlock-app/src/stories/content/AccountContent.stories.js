import React from 'react'
import { Provider } from 'react-redux'
import { storiesOf } from '@storybook/react'
import { select, withKnobs } from '@storybook/addon-knobs'
import createUnlockStore from '../../createUnlockStore'
import { ConfigContext } from '../../utils/withConfig'
import AccountContent from '../../components/content/AccountContent'

const baseState = {
  account: {},
  pageIsLocked: true,
}

const baseStateWithError = {
  ...baseState,
  errors: [
    {
      kind: 'LogIn',
      level: 'Warning',
      message: 'An error',
    },
  ],
}
const loggedInState = {
  ...baseState,
  account: {
    emailAddress: 'jenny@googlemail.com',
  },
}

const loggedInWithError = {
  ...loggedInState,
  errors: [
    {
      kind: 'Storage',
      level: 'Warning',
      message: 'An error',
    },
  ],
}
const loggedInWithCards = {
  ...baseState,
  account: {
    emailAddress: 'jenny@googlemail.com',
    cards: [
      {
        id: 'not_a_real_id',
        object: 'a string',
        brand: 'Visa',
        country: 'United States',
        dynamic_last4: '4242',
        exp_month: 12,
        exp_year: 2021,
        fingerprint: 'another string',
        funding: 'credit',
        last4: '4242',
        metadata: {},
      },
    ],
  },
  cart: {
    lock: {
      name: 'My ERC20 Lock',
      address: 'not a real address',
      keyPrice: '0.2',
      expirationDuration: 12345678,
    },
    fees: {
      creditCardProcessing: 450,
      gasFee: 30,
      keyPrice: 100,
      unlockServiceFee: 20,
    },
  },
}

const loggedInWithCardsAndError = {
  ...loggedInWithCards,
  errors: [
    {
      kind: 'Storage',
      level: 'Warning',
      message: 'An error',
    },
  ],
}

const loggedInWithCardsAndUnlocked = {
  ...loggedInWithCards,
  pageIsLocked: false,
}

const config = {
  stripeApiKey: 'pk_this_is_not_a_real_key',
}

storiesOf('AccountContent (iframe embed for paywall)', module)
  .addDecorator(withKnobs)
  .add('The embed', () => {
    const label = 'Component State'
    const options = {
      'Not logged in yet': baseState,
      'Not logged in yet (error)': baseStateWithError,
      'Logged in': loggedInState,
      'Logged in (error)': loggedInWithError,
      'Logged in with cards': loggedInWithCards,
      'Logged in with cards (error)': loggedInWithCardsAndError,
      'Logged in with cards (unlocked page)': loggedInWithCardsAndUnlocked,
    }
    const defaultValue = baseState
    const groupId = 'Group1'
    const state = select(label, options, defaultValue, groupId)
    const store = createUnlockStore(state)
    return (
      <Provider store={store}>
        <ConfigContext.Provider value={config}>
          <AccountContent />
        </ConfigContext.Provider>
      </Provider>
    )
  })
