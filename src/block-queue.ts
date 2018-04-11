import { blockchain } from "vineyard-blockchain"

export interface BlockRequest {
  blockIndex: number
  promise: any
}

export interface BlockQueueConfig {
  maxSize: number
  minSize: number
}

export interface IndexedBlock {
  index: number
}

export class ExternalBlockQueue<Block extends IndexedBlock> {
  queuedUp: number[] = []
  private blocks: Block[] = []
  private blockIndex: number
  private highestBlockIndex: number
  private client: blockchain.BlockReader<Block>
  private config: BlockQueueConfig
  requests: BlockRequest[] = []
  private listeners: {
    resolve: (block: Block[]) => void
    reject: (error: Error) => void
  }[] = []

  // p = new Profiler()

  constructor(client: blockchain.BlockReader<Block>, blockIndex: number,
              config: BlockQueueConfig) {
    this.client = client
    this.blockIndex = blockIndex
    this.config = {
      maxSize: config.maxSize || 10,
      minSize: config.minSize || 1,
    }
  }

  getBlockIndex(): number {
    return this.blockIndex
  }

  private removeRequest(blockIndex: number) {
    this.requests = this.requests.filter(r => r.blockIndex != blockIndex)
  }

  private removeBlocks(blocks: Block[]) {
    this.blocks = this.blocks.filter(b => blocks.every(b2 => b2.index != b.index))
  }

  private onResponse(blockIndex: number, block: Block | undefined) {
    // this.p.stop(blockIndex + '-blockQueue')
    // console.log('onResponse block', blockIndex, block != undefined)
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
      this.blocks.push(block)
      const listeners = this.listeners
      if (this.listeners.length > 0) {
        const readyBlocks = this.getConsecutiveBlocks()
        if (readyBlocks.length > 0) {
          this.listeners = []
          this.removeBlocks(readyBlocks)
          for (let listener of listeners) {
            listener.resolve(readyBlocks)
          }
        }
      }
      // else {
      //   console.log('no listeners')
      // }
    }
  }

  private addRequest(index: number) {
    // console.log('add block', index)
    const tryRequest: () => any = () =>
      this.client.getFullBlock(index)
        .then(block => this.onResponse(index, block))
        .catch((error) => {
          console.error('Error reading block', index, error)
          return tryRequest()
          // this.onResponse(index, undefined)
        })

    const promise = tryRequest()
    this.requests.push({
      blockIndex: index,
      promise: promise
    })
  }

  private async update(): Promise<void> {
    if (this.highestBlockIndex === undefined) {
      this.highestBlockIndex = await this.client.getHeighestBlockIndex()
    }

    const remaining = this.highestBlockIndex - this.blockIndex
    const count = Math.min(remaining, this.config.maxSize) - this.requests.length
    this.queuedUp = Array.from(new Array(count), (x, i) => i + this.blockIndex)
    console.log("Adding blocks: " + this.queuedUp.join(', '))
    for (let i = 0; i < count; ++i) {
      this.addRequest(this.blockIndex++)
    }
  }

  // Ensures that batches of blocks are returned in consecutive order
  private getConsecutiveBlocks(): Block[] {
    if (this.blocks.length == 0)
      return []

    const results = this.blocks.concat([]).sort((a, b) => a.index > b.index ? 1 : -1)
    const oldestRequest = this.requests.map(r => r.blockIndex).sort()[0]
    const oldestResult = results[0].index
    if (oldestRequest && oldestResult > oldestRequest) {
      // console.log('oldestRequest', oldestRequest, 'oldestResult', oldestResult)
      return []
    }

    const blocks = []
    let i = oldestResult
    for (let r of results) {
      if (r.index != i++)
        break

      blocks.push(r)
    }

    if (blocks.length < this.config.minSize && this.requests.length > 0) {
      return []
    }
    return blocks
  }

  async getBlocks(): Promise<Block[]> {
    await this.update()

    const readyBlocks = this.getConsecutiveBlocks()
    if (readyBlocks.length > 0) {
      this.removeBlocks(readyBlocks)
      return Promise.resolve(readyBlocks)
    }
    else if (this.requests.length == 0) {
        return Promise.resolve([])
    }
    else {
      return new Promise<Block[]>((resolve, reject) => {
        this.listeners.push({
          resolve: resolve,
          reject: reject
        })
      })
    }
  }
}
