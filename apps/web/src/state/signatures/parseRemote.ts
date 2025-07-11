import { TradeType } from '@uniswap/sdk-core'
import { gqlToCurrency, supportedChainIdFromGQLChain } from 'appGraphql/data/util'
import { parseUnits } from 'ethers/lib/utils'
import store from 'state'
import { addSignature } from 'state/signatures/reducer'
import { OrderActivity, SignatureDetails, SignatureType } from 'state/signatures/types'
import { UniswapXOrderStatus } from 'types/uniswapx'
import { SwapOrderStatus, SwapOrderType } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { TransactionType } from 'uniswap/src/features/transactions/types/transactionDetails'
import { currencyId } from 'uniswap/src/utils/currencyId'
import { logger } from 'utilities/src/logger/logger'

const SIGNATURE_TYPE_MAP: { [key in SwapOrderType]: SignatureType } = {
  [SwapOrderType.Limit]: SignatureType.SIGN_LIMIT,
  [SwapOrderType.Dutch]: SignatureType.SIGN_UNISWAPX_ORDER,
  [SwapOrderType.DutchV2]: SignatureType.SIGN_UNISWAPX_V2_ORDER,
  [SwapOrderType.Priority]: SignatureType.SIGN_PRIORITY_ORDER,
  // [SwapOrderType.DutchV3]: SignatureType.SIGN_UNISWAPX_V3_ORDER, TODO: Backend needs to support this
}

const ORDER_STATUS_MAP: { [key in SwapOrderStatus]: UniswapXOrderStatus } = {
  [SwapOrderStatus.Open]: UniswapXOrderStatus.OPEN,
  [SwapOrderStatus.Expired]: UniswapXOrderStatus.EXPIRED,
  [SwapOrderStatus.Error]: UniswapXOrderStatus.ERROR,
  [SwapOrderStatus.InsufficientFunds]: UniswapXOrderStatus.INSUFFICIENT_FUNDS,
  [SwapOrderStatus.Filled]: UniswapXOrderStatus.FILLED,
  [SwapOrderStatus.Cancelled]: UniswapXOrderStatus.CANCELLED,
}

export function parseRemote({ chain, details, timestamp }: OrderActivity): SignatureDetails {
  const chainId = supportedChainIdFromGQLChain(chain)
  if (!chainId) {
    const error = new Error('Invalid activity from unsupported chain received from GQL')
    logger.error(error, {
      tags: {
        file: 'parseRemote',
        function: 'parseRemote',
      },
      extra: { details },
    })
    throw error
  }

  const status = ORDER_STATUS_MAP[details.orderStatus]
  const isFilled = status === UniswapXOrderStatus.FILLED

  const inputTokenQuantity = parseUnits(details.inputTokenQuantity, details.inputToken.decimals).toString()
  const outputTokenQuantity = parseUnits(details.outputTokenQuantity, details.outputToken.decimals).toString()

  if (inputTokenQuantity === '0' || outputTokenQuantity === '0') {
    // TODO(WEB-3765): This is a temporary mitigation for a bug where the backend sends "0.000000" for small amounts.
    throw new Error('Invalid activity received from GQL')
  }

  const inputCurrencyId = currencyId(gqlToCurrency(details.inputToken))
  const outputCurrencyId = currencyId(gqlToCurrency(details.outputToken))

  if (!inputCurrencyId || !outputCurrencyId) {
    throw new Error('Invalid activity received from GQL')
  }

  const signature: SignatureDetails = {
    id: details.id,
    type: SIGNATURE_TYPE_MAP[details.swapOrderType],
    offerer: details.offerer,
    chainId,
    orderHash: details.hash,
    expiry: details.expiry,
    encodedOrder: details.encodedOrder,
    addedTime: timestamp,
    ...(isFilled
      ? {
          status: UniswapXOrderStatus.FILLED,
          txHash: details.hash,
        }
      : {
          status,
          txHash: undefined,
        }),

    swapInfo: {
      isUniswapXOrder: true,
      type: TransactionType.Swap,
      // This doesn't affect the display, but we don't know this value from the remote activity.
      tradeType: TradeType.EXACT_INPUT,
      inputCurrencyId,
      outputCurrencyId,
      inputCurrencyAmountRaw: inputTokenQuantity,
      expectedOutputCurrencyAmountRaw: outputTokenQuantity,
      minimumOutputCurrencyAmountRaw: outputTokenQuantity,
      settledOutputCurrencyAmountRaw: isFilled ? outputTokenQuantity : undefined,
    },
  }

  if (status === UniswapXOrderStatus.OPEN) {
    // Update this asynchronously to avoid updating other components during this render cycle.
    setTimeout(() => {
      store.dispatch(addSignature(signature))
    }, 0)
  }

  return signature
}
