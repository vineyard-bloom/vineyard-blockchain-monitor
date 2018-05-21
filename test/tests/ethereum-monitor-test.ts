import { ethereumConfig } from "../config/config"

require('source-map-support').install()
import BigNumber from "bignumber.js";
import { EthereumModel } from "../../src";
import { startEthereumMonitor, createVillage, MinotaurVillage, EthereumVillage, createEthereumVillage } from "../../lab"
import { assert } from 'chai'
import { blockchain } from "vineyard-blockchain"

const second = 1000
const minute = 60 * second

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
    maxMilliseconds: 1 * minute
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
      maxMilliseconds: 1 * minute
    })
    assert(true)
  })

  // This block has a contract with a malformed ERC20 token name
  it('from 142937', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 142936 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 10 * second
    })

    await model.LastBlock.update({ currency: 2, blockIndex: 142966 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 10 * second
    })
    assert(true)
  })

  it('from 4 mil', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4000000 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 1 * minute
    })
    assert(true)
  })

  it('can rescan', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4000000 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 0.1 * minute
    })

    await model.LastBlock.update({ currency: 2, blockIndex: 4000000 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 10, minSize: 1 },
      maxMilliseconds: 0.2 * minute
    })
    assert(true)
  })

  it('scans tokens', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 4086319 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 1 * minute
    })

    const tokens = await model.Token.all()
    assert.isAtLeast(tokens.length, 1)
  })

  it('detects successful token transfers', async function () {
    await createSaltContract(village)

    await model.LastBlock.create({ currency: 2, blockIndex: 5146973 })
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 2 * second
    })

    const transfers = await model.TokenTransfer.all()
    assert.isAtLeast(transfers.length, 1)
  })

  it('pulls transactions for block 523730', async function () {
    await model.LastBlock.create({ currency: 2, blockIndex: 523730 })
    console.log('Initialized village')
    await startEthereumMonitor(village, {
      queue: { maxSize: 1, minSize: 1 },
      maxMilliseconds: 10 * second
    })

    const transactions = await model.Transaction.all()
    assert.equal(transactions.length, 1, 'There should only be 1 transaction in block 523730')
  })

})