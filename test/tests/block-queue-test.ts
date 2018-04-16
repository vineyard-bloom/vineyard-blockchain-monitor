import { blockchain } from "vineyard-blockchain/src/blockchain"

require('source-map-support').install()
import { EthereumModel } from "../../src";
import { assert } from 'chai'
import { BitcoinVillage, createBitcoinVillage, startBitcoinMonitor } from "../../lab"
import { localConfig } from "../config/config"
import BlockReader = blockchain.BlockReader
import { ExternalBlockQueue } from "../../src/block-queue"

describe('queue test', function () {
  // let underTest: ExternalBlockQueue<MockBlock>

  beforeEach(async function () {

  })

  it('test 1', async function () {
    this.timeout(25000)

    const highestBlock = 10
    const getBlocksResponseSize = 5
    const numberToProcessPerGetBlocksCall = 5

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 5)
    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 5)
  })

  it('test 2', async function () {
    this.timeout(25000)

    const highestBlock = 11
    const getBlocksResponseSize = 5
    const numberToProcessPerGetBlocksCall = 5

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 5)
    assert.equal(underTest.queuedUp.length, 5)
    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 5)
    assert.equal(underTest.queuedUp.length, 5)
    const thirdBlocks = await underTest.getBlocks()
    assert.equal(thirdBlocks.length, 1)
    assert.equal(underTest.queuedUp.length, 1)
  })

  it('test 3', async function () {
    this.timeout(25000)

    const highestBlock = 10
    const getBlocksResponseSize = 4
    const numberToProcessPerGetBlocksCall = 5

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 4)
    assert.equal(underTest.queuedUp.length, 5)

    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 4)
    assert.equal(underTest.queuedUp.length, 5)

    const thirdBlocks = await underTest.getBlocks()
    assert.equal(thirdBlocks.length, 2)
    assert.equal(underTest.queuedUp.length, 0)
  })

  it('test 4: undefined', async function () {
    this.timeout(25000)

    const highestBlock = 10
    const getBlocksResponseSize = 5
    const numberToProcessPerGetBlocksCall = 5

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock, (index) => index == 2),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 2)
    assert.equal(firstBlocks[1].index, 1)
    assert.equal(underTest.queuedUp.length, 5)

    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 5)
    assert.equal(secondBlocks[0].index, 3)
    assert.equal(underTest.queuedUp.length, 5)

    const thirdBlocks = await underTest.getBlocks()
    assert.equal(thirdBlocks.length, 2)
    assert.equal(underTest.queuedUp.length, 0)
  })

  it('test 5: undefined', async function () {
    this.timeout(25000)

    const highestBlock = 10
    const getBlocksResponseSize = 5
    const numberToProcessPerGetBlocksCall = 5

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock, (index) => index == 0),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 4) //1, 2, 3, 4
    assert.equal(underTest.queuedUp.length, 5)

    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 5)
  })

  it('test 6: undefined', async function () {
    this.timeout(25000)

    const highestBlock = 10
    const getBlocksResponseSize = 5
    const numberToProcessPerGetBlocksCall = 5

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock, (index) => index == 4),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 4) //0, 1, 2, 3
    assert.equal(underTest.queuedUp.length, 5)

    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 5)
  })

  it('test 7: undefined', async function () {
    this.timeout(25000)

    const highestBlock = 10
    const getBlocksResponseSize = 5
    const numberToProcessPerGetBlocksCall = 8

    const underTest = new ExternalBlockQueue(
      getMockBlockReader(highestBlock, never,(index) => index == 7),
      0,
      {
        maxSize: numberToProcessPerGetBlocksCall,
        minSize: getBlocksResponseSize
      }
    )

    const firstBlocks = await underTest.getBlocks()
    assert.equal(firstBlocks.length, 5)
    assert.equal(underTest.queuedUp.length, 8)

    const secondBlocks = await underTest.getBlocks()
    assert.equal(secondBlocks.length, 4)
    assert.equal(underTest.queuedUp.length, 5)
  })
})

export type MockBlock = { index: number }
export const never = (index: number) => false
export function getMockBlockReader(
  highestBlock: number,
  undefinedCondition: (index: number) => boolean = never,
  errorCondition: (index: number) => boolean = never)
: BlockReader<MockBlock> {
  return {
    getHeighestBlockIndex: async () => {
      return highestBlock
    },

    getFullBlock: async (index: number) => {
      if(errorCondition(index)) throw new Error('Testing an error')
      if(undefinedCondition(index)) return undefined
      await timeout(500)
      return { index }
    }
  }
}

const timeout = (ms: number) => new Promise(res => setTimeout(res, ms))
