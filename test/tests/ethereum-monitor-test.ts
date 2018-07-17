import { ethereumConfig } from '../config/config'

require('source-map-support').install()
import BigNumber from 'bignumber.js';
import { gatherInternalTransactions, EthereumModel, saveBlocks, saveInternalTransactions, InternalTransactionBundle } from '../../src';
import { startEthereumMonitor, EthereumVillage, createEthereumVillage } from '../../lab'
import { assert } from 'chai'
import { blockchain } from 'vineyard-blockchain'

const second = 1000
const minute = 60 * second

async function assertThrowsErrorMessage(codeToRun: () => any, message: string): Promise<void> {
  try {
    await codeToRun();
    assert(false);
  } catch (e) {
    console.error(e)
    assert.equal(e.message, message);
  }
}

async function createTokenContract(village: EthereumVillage, token: blockchain.TokenContract & { from: string }) {
  const from = await village.model.Address.create({
    address: token.from
  })

  const address = await village.model.Address.create({
    address: token.address
  })

  const transaction = await village.model.Transaction.create({
    txid: token.txid,
    currency: 2,
    from: from.id,
    timeReceived: new Date()
  })

  const contract = await village.model.Contract.create({
    address: address.id,
    transaction: transaction.id
  })

  const currency = await village.model.Currency.create({
    name: token.name
  })

  await village.model.Token.create({
    id: currency.id,
    name: token.name,
    contract: contract.id,
    totalSupply: token.totalSupply,
    decimals: token.decimals,
    version: token.version,
    symbol: token.symbol
  })
}

async function createSaltContract(village: EthereumVillage) {
  await createTokenContract(village, {
    contractType: blockchain.ContractType.token,
    name: 'Salt',
    totalSupply: new BigNumber('12000000000000000'),
    decimals: new BigNumber(8),
    version: '1.0',
    symbol: 'SALT',
    address: '0x4156D3342D5c385a87D264F90653733592000581',
    from: '0x5d239fB4d8767745bE329d38703CdF4094858766',
    txid: '0xa7ead12fc3b20bc4555b26bcc8de55d651e90ba0da445bddad61eeaed2d28e17',
  } as any)
}

async function createSaltContractReal(village: EthereumVillage) {
  await village.model.LastBlock.create({ currency: 2, blockIndex: 4086319 })
  await startEthereumMonitor(village, {
    queue: { maxSize: 1, minSize: 1 },
    maxMilliseconds: 1 * minute,
    profiling: ethereumConfig.profiling ? true : false
  })
}

describe('eth-scan', function () {
  this.timeout(10 * minute)
  let village: EthereumVillage
  let model: EthereumModel

  beforeEach(async function () {
    village = await createEthereumVillage(ethereumConfig)
    model = village.model
    await (model.ground as any).regenerate()
    await model.Currency.create({ name: 'Bitcoin' })
    await model.Currency.create({ name: 'Ethereum' })
  })

  it('from start', async function () {
    await model.LastBlock.create({ currency: 2 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 1 * minute,
      profiling: ethereumConfig.profiling ? true : false
    })
    assert(true)
  })

  // This block has a contract with a malformed ERC20 token name
  it('from 142937', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 142936 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 10 * second,
      profiling: ethereumConfig.profiling ? true : false
    })

    await model.LastBlock.update({ currency: 2, blockIndex: 142966 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 10 * second,
      profiling: ethereumConfig.profiling ? true : false
    })
    assert(true)
  })

  it('from 4 mil', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4000000 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 1 * minute,
      profiling: ethereumConfig.profiling ? true : false
    })
    assert(true)
  })

  it('can rescan', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4000000 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 0.1 * minute,
      profiling: ethereumConfig.profiling ? true : false
    })

    await model.LastBlock.update({ currency: 2, blockIndex: 4000000 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 0.2 * minute,
      profiling: ethereumConfig.profiling ? true : false
    })
    assert(true)
  })

  it('scans tokens', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4086319 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 1 * minute,
      profiling: ethereumConfig.profiling ? true : false
    })

    const tokens = await model.Token.all()
    assert.isAtLeast(tokens.length, 1)
  })

  it.skip('detects successful token transfers', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 447767 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 10 },
      maxMilliseconds: 1 * minute,
      profiling: ethereumConfig.profiling ? true : false
    })

    const transfers = await model.TokenTransfer.all()
    assert.isAtLeast(transfers.length, 1)
  })

  it('saveBlocks throws an error when passed an empty blocks array', async function () {
    await assertThrowsErrorMessage(() => saveBlocks(model.ground, []), 'blocks array must not be empty')
  })

  it('can convert an internal transaction to the correct format for saving', async function () {
    const transactions: blockchain.ContractTransaction[] = [{
      from: 'someone nice',
      txid: 'one',
      timeReceived: new Date(),
      status: 3,
      fee: new BigNumber(1),
      nonce: 1,
      blockIndex: 1,
      amount: new BigNumber(1),
      gasUsed: 1,
      gasPrice: new BigNumber(1),
      internalTransactions: [{
        transaction: {
          txid: 'one',
          timeReceived: new Date(),
          status: 3,
          fee: new BigNumber(1),
          nonce: 1 
        },
        to: 'One dude',
        from: 'Another dude',
        amount: new BigNumber(1)
      }]
    }, {
      from: 'someone mean',
      txid: 'two',
      timeReceived: new Date(),
      status: 3,
      fee: new BigNumber(2),
      nonce: 2,
      blockIndex: 2,
      amount: new BigNumber(2),
      gasUsed: 2,
      gasPrice: new BigNumber(2),
      internalTransactions: [{
        transaction: {
          txid: 'two',
          timeReceived: new Date(),
          status: 3,
          fee: new BigNumber(2),
          nonce: 2
        },
        to: 'One buddy',
        from: 'Another buddy',
        amount: new BigNumber(2)
      }, {
        transaction: {
          txid: 'two',
          timeReceived: new Date(),
          status: 3,
          fee: new BigNumber(2),
          nonce: 2
        },
        to: 'One friend',
        from: 'Another friend',
        amount: new BigNumber(20)
      }]
    }, {
      from: 'someone in between',
      txid: 'three',
      timeReceived: new Date(),
      status: 3,
      fee: new BigNumber(3),
      nonce: 3,
      blockIndex: 3,
      amount: new BigNumber(3),
      gasUsed: 3,
      gasPrice: new BigNumber(3)
    }]

    const internalTransactions = gatherInternalTransactions(transactions)
    const expected = [{
      txid: 'one',
      internalTransaction:
        {
          transaction: {
            txid: 'one',
            timeReceived: new Date(),
            status: 3,
            fee: new BigNumber(1),
            nonce: 1 
          },
          to: 'One dude',
          from: 'Another dude',
          amount: new BigNumber(1)
        }
    },
    {
      txid: 'two',
      internalTransaction:
        {
          transaction: {
            txid: 'two',
            timeReceived: new Date(),
            status: 3,
            fee: new BigNumber(2),
            nonce: 2
          },
          to: 'One buddy',
          from: 'Another buddy',
          amount: new BigNumber(2)
        }
    },
    {
      txid: 'two',
      internalTransaction:
        {
          transaction: {
            txid: 'two',
            timeReceived: new Date(),
            status: 3,
            fee: new BigNumber(2),
            nonce: 2
          },
          to: 'One friend',
          from: 'Another friend',
          amount: new BigNumber(20)
        }
    }]

    assert.deepEqual(internalTransactions, expected)
  })

  it('can save an internal transaction to the DB', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4000000 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 10 * second
    })

    const internalTransactions: InternalTransactionBundle[] = [{
      txid: '0x7dffbdeecadfb6db737ae0871bf1e41341b9b5f4fcee3e3c7a52433cab208a36',
      internalTransaction: {
        transaction: {
          txid: '0x7dffbdeecadfb6db737ae0871bf1e41341b9b5f4fcee3e3c7a52433cab208a36',
          timeReceived: new Date(),
          status: 3,
          fee: new BigNumber(1),
          nonce: 2
        },
        to: '0xB97048628DB6B661D4C2aA833e95Dbe1A905B280',
        from: '0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98',
        amount: new BigNumber(4)
      }
    }]

    await saveInternalTransactions(model.ground, internalTransactions)
  })

})