import { blockchain } from "vineyard-blockchain"

export interface BlockRequest {
  blockIndex: number
  promise: any
}

export interface BlockQueueConfig {
  maxSize: number
  maxBlockRequests: number
  minSize: number
}

const blockQueueConfigDefaults = {
  maxSize: 10,
  maxBlockRequests: 5,
  minSize: 1
}

interface IndexedBlock<Block> {
  index: number
  block: Block
}

type SimpleFunction = () => Promise<any>

export class ExternalBlockQueue<Block> {
  private blocks: IndexedBlock<Block>[] = []
  private blockIndex: number
  private highestBlockIndex: number
  private client: blockchain.BlockReader<Block>
  private config: BlockQueueConfig
  requests: BlockRequest[] = []
  private listeners: {
    resolve: (block: Block[]) => void
    reject: (error: Error) => void
  }[] = []

  constructor(client: blockchain.BlockReader<Block>, blockIndex: number, highestBlockIndex: number,
              config: Partial<BlockQueueConfig>) {
    this.client = client
    this.blockIndex = blockIndex
    this.highestBlockIndex = highestBlockIndex
    this.config = { ...blockQueueConfigDefaults, ...config }
  }

  getBlockIndex(): number {
    return this.blockIndex
  }

  private removeRequest(blockIndex: number) {
    this.requests = this.requests.filter(r => r.blockIndex != blockIndex)
  }

  private removeBlocks(blocks: IndexedBlock<Block>[]) {
    this.blocks = this.blocks.filter(b => blocks.every(b2 => b2.index != b.index))
  }

  private onResponse(blockIndex: number, block: Block | undefined) {
    this.removeRequest(blockIndex)

    if (!block) {
      if (this.listeners.length > 0) {
        const listeners = this.listeners
        this.listeners = []
        for (let listener of listeners) {
          listener.reject(new Error("Error loading block"))
        }
      }
    }
    else {
      this.blocks.push({ block, index: blockIndex })
      const listeners = this.listeners
      if (this.listeners.length > 0) {
        const readyBlocks = this.getConsecutiveBlocks()
        if (readyBlocks.length >= this.config.minSize || this.requests.length == 0) {
          this.listeners = []
          const result = this.releaseBlocks(readyBlocks)
          for (let listener of listeners) {
            listener.resolve(result)
          }
        }
      }
    }
  }

  private addRequest(index: number) {
    // console.log('add block', index)
    const tryRequest: SimpleFunction = async () => {
      try {
        const block = await this.client.getFullBlock(index)
        await this.onResponse(index, block)
      }
      catch (error) {
        console.error('Error reading block', index, error)
        await tryRequest()
        // this.onResponse(index, undefined)
      }
    }

    const promise = tryRequest()
    this.requests.push({
      blockIndex: index,
      promise: promise
    })
  }

  private getNextRequestCount(): number {
    const remaining = this.highestBlockIndex - this.blockIndex
    const count = Math.min(
      remaining,
      this.config.maxBlockRequests - this.requests.length,
      this.config.maxSize - this.requests.length - this.blocks.length
    )
    return count < 0
      ? 0
      : count
  }

  private update(requestCount: number) {
    console.log('Adding blocks', Array.from(new Array(requestCount), (x, i) => i + this.blockIndex).join(', '))
    for (let i = 0; i < requestCount; ++i) {
      this.addRequest(this.blockIndex++)
    }
  }

  // Ensures that batches of blocks are returned in consecutive order
  private getConsecutiveBlocks(): IndexedBlock<Block>[] {
    if (this.blocks.length == 0)
      return []

    const results = this.blocks.concat([]).sort((a, b) => a.index > b.index ? 1 : -1)
    const oldestRequest = this.requests.map(r => r.blockIndex).sort()[0]
    const oldestResult = results[0].index
    if (oldestRequest && oldestResult > oldestRequest) {
      return []
    }

    const blocks: IndexedBlock<Block>[] = []
    let i = oldestResult
    for (let r of results) {
      if (r.index != i++)
        break

      blocks.push(r)
    }

    return blocks
  }

  private async addListener() {
    return new Promise<Block[]>((resolve, reject) => {
      this.listeners.push({
        resolve: resolve,
        reject: reject
      })
    })
  }

  private releaseBlocks(blocks: IndexedBlock<Block>[]): Block[] {
    this.removeBlocks(blocks)
    return blocks.map(i => i.block)
  }

  async getBlocks(): Promise<Block[]> {
    const readyBlocks = this.getConsecutiveBlocks()
    const nextRequestCount = this.getNextRequestCount()

    if (nextRequestCount == 0) {
      return this.releaseBlocks(readyBlocks)
    }
    else {
      this.update(nextRequestCount)
      return readyBlocks.length >= this.config.minSize
        ? this.releaseBlocks(readyBlocks)
        : this.addListener()
    }
  }
}
