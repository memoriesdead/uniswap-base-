import { TradeType } from '@uniswap/sdk-core'
import { createStore, Store } from 'redux'
import reducer, {
  addSignature,
  initialState,
  removeSignature,
  SignatureState,
  updateSignature,
} from 'state/signatures/reducer'
import { SignatureDetails, SignatureType } from 'state/signatures/types'
import { UniswapXOrderStatus } from 'types/uniswapx'
import { TransactionType } from 'uniswap/src/features/transactions/types/transactionDetails'

const account = '0xabc'

const signature: SignatureDetails = {
  id: '0x0',
  addedTime: 0,
  expiry: 0,
  status: UniswapXOrderStatus.OPEN,
  type: SignatureType.SIGN_UNISWAPX_ORDER,
  chainId: 1,
  orderHash: '0x0',
  offerer: account,
  swapInfo: {
    type: TransactionType.Swap,
    tradeType: TradeType.EXACT_INPUT,
    inputCurrencyAmountRaw: '0',
    minimumOutputCurrencyAmountRaw: '0',
    expectedOutputCurrencyAmountRaw: '0',
    inputCurrencyId: '0x1',
    outputCurrencyId: '0x2',
    isUniswapXOrder: true,
  },
}

describe('signature reducer', () => {
  let store: Store<SignatureState>

  beforeEach(() => {
    store = createStore(reducer, initialState)
  })

  describe('addSignature', () => {
    it('adds the transaction', () => {
      store.dispatch(addSignature(signature))

      const txs = store.getState()

      expect(txs).toStrictEqual({
        [account]: {
          [signature.id]: signature,
        },
      })

      // Adding a signature w/ same id should be a no-op
      store.dispatch(addSignature(signature))
      expect(store.getState()).toStrictEqual({
        [account]: {
          [signature.id]: signature,
        },
      })
    })
  })

  describe('updateSignature', () => {
    it('updates the signature', () => {
      store.dispatch(addSignature(signature))
      const updatedSignature = { ...signature, status: UniswapXOrderStatus.CANCELLED } as const
      store.dispatch(updateSignature(updatedSignature))

      const txs = store.getState()

      expect(txs).toStrictEqual({
        [account]: {
          [signature.id]: updatedSignature,
        },
      })

      expect(() => store.dispatch(updateSignature({ ...signature, id: 'non existent id' }))).toThrow()
    })
  })

  describe('removeSignature', () => {
    it('updates the signature', () => {
      store.dispatch(addSignature(signature))
      store.dispatch(removeSignature(signature))

      const txs = store.getState()

      expect(txs).toStrictEqual({
        [account]: {},
      })
    })
  })
})
