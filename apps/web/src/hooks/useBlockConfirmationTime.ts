import { useEffect, useState } from 'react'
import { useAccount } from '~/hooks/useAccount'
import { useEthersProvider } from '~/hooks/useEthersProvider'
import useBlockNumber from '~/lib/hooks/useBlockNumber'

export function useBlockConfirmationTime() {
  const account = useAccount()
  const provider = useEthersProvider({ chainId: account.chainId })
  const currentBlockNumber = useBlockNumber()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [blockConfirmationTime, setBlockConfirmationTime] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(false)
    async function fetchBlockConfirmationTime() {
      if (!provider || !currentBlockNumber) {
        setLoading(false)
        return
      }
      try {
        const [currentBlock, previousBlock] = await Promise.all([
          provider.getBlock(currentBlockNumber),
          provider.getBlock(currentBlockNumber - 1),
        ])

        if (currentBlock.timestamp && previousBlock.timestamp) {
          setBlockConfirmationTime(currentBlock.timestamp - previousBlock.timestamp)
        } else {
          setError(true)
          setBlockConfirmationTime(null)
        }
      } catch {
        setError(true)
        setBlockConfirmationTime(null)
      }
      setLoading(false)
    }
    fetchBlockConfirmationTime()
  }, [currentBlockNumber, provider])

  return { loading, error, blockConfirmationTime }
}
