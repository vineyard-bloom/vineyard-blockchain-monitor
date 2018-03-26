import { BaseBlock, LastBlock, LastBlockDao, MonitorDao, TransactionDao } from "./types"
import { createIndexedLastBlockDao, setStatus } from "./monitor-dao"
import { blockchain } from "vineyard-blockchain"
import BigNumber from "bignumber.js"
import { EmptyProfiler, Profiler } from "./utility/profiler"
import { ExternalBlockQueue, FullBlock, SingleTransactionBlockClient } from "./block-queue"
import { Collection, Modeler } from 'vineyard-data/legacy'

export interface EthereumTransaction extends blockchain.BlockTransaction {
  to?: number
  from?: number
}

export interface Address {
  id: number
  address: string
  balance: BigNumber
}

export interface Currency {
  id: number
  address?: number
  name: string
}

export type AddressDelegate = (externalAddress: string) => Promise<number>

export interface TokenTransferRecord {

}

export interface EthereumModel {
  Address: Collection<Address>
  Currency: Collection<any>
  Contract: Collection<blockchain.Contract & { id: number }>
  Block: Collection<blockchain.Block>
  Token: Collection<blockchain.TokenContract>
  TokenTransfer: Collection<TokenTransferRecord>
  Transaction: Collection<EthereumTransaction & { id: number }>
  LastBlock: Collection<LastBlock>

  ground: Modeler
}

export interface EthereumMonitorDao extends MonitorDao {
  getOrCreateAddress: AddressDelegate,
  ground: Modeler
}

export async function saveSingleCurrencyBlock(blockCollection: Collection<blockchain.Block>,
                                              block: blockchain.Block): Promise<void> {

  const existing = await blockCollection.first({ index: block.index })
  if (existing)
    return

  await blockCollection.create(block)
}

export function getTransactionByTxid<Tx>(transactionCollection: Collection<Tx>,
                                         txid: string): Promise<Tx | undefined> {
  return transactionCollection.first({ txid: txid }).exec()
}

export async function getOrCreateAddressReturningId(addressCollection: Collection<Address>,
                                                    externalAddress: string): Promise<number> {
  const internalAddress = await addressCollection.first({ address: externalAddress })
  return internalAddress
    ? internalAddress.id
    : (await addressCollection.create({ address: externalAddress })).id
}

export function createSingleCurrencyTransactionDao(model: EthereumModel): TransactionDao<EthereumTransaction> {
  return {
    getTransactionByTxid: getTransactionByTxid.bind(null, model.Transaction),
    saveTransaction: async (transaction: EthereumTransaction) => {
      await model.Transaction.create(transaction)
    },
    setStatus: setStatus.bind(null, model.Transaction)
  }
}

export function createEthereumExplorerDao(model: EthereumModel): EthereumMonitorDao {
  return {
    blockDao: {
      saveBlock: (block: BaseBlock) => saveSingleCurrencyBlock(model.Block, block)
    },
    lastBlockDao: createIndexedLastBlockDao(model.ground, 2),
    // transactionDao: createSingleCurrencyTransactionDao(model),
    getOrCreateAddress: (externalAddress: string) => getOrCreateAddressReturningId(model.Address, externalAddress),
    ground: model.ground
  }
}

export interface MonitorConfig {
  maxConsecutiveBlocks?: number,
  maxMilliseconds?: number,
  maxBlocksPerScan?: number
}

export async function getNextBlock(lastBlockDao: LastBlockDao) {
  const lastBlockIndex = await lastBlockDao.getLastBlock()
  return typeof lastBlockIndex === 'number' ? lastBlockIndex + 1 : 0
}

type AddressMap = { [key: string]: number }

function gatherAddresses(blocks: FullBlock[], contracts: blockchain.Contract[], tokenTransfers: TokenTransferBundle[]) {
  const addresses: AddressMap = {}
  for (let block of blocks) {
    for (let transaction of block.transactions) {
      if (transaction.to)
        addresses [transaction.to] = -1

      if (transaction.from)
        addresses [transaction.from] = -1
    }
  }

  for (let contract of contracts) {
    addresses[contract.address] = -1
  }

  for (let transfer of tokenTransfers) {
    addresses[transfer.decoded.args.to] = -1
    addresses[transfer.decoded.args.from] = -1
  }

  return addresses
}

async function setAddress(getOrCreateAddress: AddressDelegate, addresses: AddressMap, key: string) {
  const id = await getOrCreateAddress(key)
  addresses[key] = id
}

function saveTransactions(ground: any, blocks: FullBlock[], addresses: AddressMap) {
  let transactionClauses: string[] = []
  const header = 'INSERT INTO "transactions" ("status", "txid", "to", "from", "amount", "fee", "nonce", "currency", "timeReceived", "blockIndex", "created", "modified") VALUES\n'
  for (let block of blocks) {
    transactionClauses = transactionClauses.concat(
      block.transactions.map(t => {
        const to = t.to ? addresses[t.to] : 'NULL'
        const from = t.from ? addresses[t.from] : 'NULL'
        return `(${t.status}, '${t.txid}', ${to}, ${from}, ${t.amount}, ${t.fee}, ${t.nonce}, 2, '${t.timeReceived.toISOString()}', ${t.blockIndex}, NOW(), NOW())`
      })
    )
  }

  if (transactionClauses.length == 0)
    return Promise.resolve()

  const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;'
  return ground.querySingle(sql)
}

async function getOrCreateAddresses(ground: Modeler, addresses: AddressMap) {
  {
    const addressClauses: string [] = []
    for (let i in addresses) {
      addressClauses.push(`'${i}'`)
    }
    if (addressClauses.length == 0)
      return Promise.resolve()

    const header = `SELECT "id", "address" FROM addresses
  WHERE "address" IN (
  `
    const sql = header + addressClauses.join(',\n') + ');'
    const rows = await ground.query(sql)
    for (let row of rows) {
      addresses[row.address] = parseInt(row.id)
    }
  }
  {
    const inserts: string[] = []
    for (let i in addresses) {
      const value = addresses[i]
      if (value === -1) {
        inserts.push(`('${i}', NOW(), NOW())`)
      }
    }
    if (inserts.length == 0)
      return Promise.resolve()

    const insertHeader = 'INSERT INTO "addresses" ("address", "created", "modified") VALUES\n'
    const sql = insertHeader + inserts.join(',\n') + ' ON CONFLICT DO NOTHING RETURNING "id", "address";'
    const rows = await ground.query(sql)
    for (let row of rows) {
      addresses[row.address] = parseInt(row.id)
    }
  }
}

async function saveBlocks(ground: Modeler, blocks: blockchain.Block[]) {
  const header = 'INSERT INTO "blocks" ("index", "hash", "timeMined", "created", "modified") VALUES\n'
  let inserts: string[] = []
  for (let block of blocks) {
    inserts.push(`(${block.index}, '${block.hash}', '${block.timeMined.toISOString()}', NOW(), NOW())`)
  }

  const sql = header + inserts.join(',\n') + ' ON CONFLICT DO NOTHING;'
  return ground.querySingle(sql)
}

interface CurrencyResult { currency: any, tokenContract: blockchain.TokenContract }

async function saveCurrencies(ground: Modeler, tokenContracts: blockchain.Contract[]): Promise<CurrencyResult[]> {
  const result = []
  for (let contract of tokenContracts) {
    const token = contract as blockchain.TokenContract
    const record = await ground.collections.Currency.create({
      name: token.name
    })
    result.push({
      currency: record,
      tokenContract: token
    })
  }
  return result
  // let i = 1
  // const values: any = {}
  // const tokenClauses: string[] = tokenContracts.map(contract => {
  //     const token = contract as blockchain.TokenContract
  //     const key = 'name' + i++
  //     values[key] = token.name
  //     return `(:${key}, NOW(), NOW())`
  //   }
  // )


  // return result.map((c: any) => ({
  //   id: parseInt(c.id),
  //   name: c.name
  // }))
}

async function saveContracts(ground: Modeler, contracts: blockchain.Contract[], addresses: AddressMap): Promise<void> {
  if (contracts.length == 0)
    return Promise.resolve()

  const contractClauses: string[] = contracts.map(contract =>
    `(${addresses[contract.address]}, (SELECT transactions.id FROM transactions WHERE txid = '${contract.txid}'), NOW(), NOW())`
  )

  const header = 'INSERT INTO "contracts" ("address", "transaction", "created", "modified") VALUES\n'
  const sql = header + contractClauses.join(',\n') + ' ON CONFLICT DO NOTHING RETURNING "id", "address";'
  const contractRecords = (await ground.query(sql))
    .map((c: any) => ({
      id: parseInt(c.id),
      address: parseInt(c.address)
    }))

  const tokenContracts = contracts.filter(c => c.contractType == blockchain.ContractType.token)
  if (tokenContracts.length == 0)
    return

  const currencyContracts = await saveCurrencies(ground, tokenContracts)

  for (const bundle of currencyContracts) {
    const token = bundle.tokenContract
    const address = addresses[token.address]
    const contractRecord = contractRecords.filter((c: any) => c.address === address)[0]
    if (!contractRecord) // Must be rescanning a block and already have a contract record
      continue

    const currency = bundle.currency
    ground.collections.Token.create({
      id: currency.id,
      contract: contractRecord.id,
      name: token.name,
      totalSupply: token.totalSupply,
      decimals: token.decimals.toNumber(),
      version: token.version,
      symbol: token.symbol
    })
  }
//   {
//     let i = 1
//     const values: any = {}
//     const tokenClauses: string[] = currencyContracts.map(bundle => {
//         const token = bundle.tokenContract
//         const address = addresses[token.address]
//         const contractRecord = contractRecords.filter((c: any) => c.address === address)[0]
//         const currency = bundle.currency
//         const nameKey = 'name' + i++
//         values[nameKey] = token.name
//         return `(${currency.id}, ${contractRecord.id}, :${nameKey}, '${token.totalSupply}', '${token.decimals}',
//       '${token.version}', '${token.symbol}', NOW(), NOW())`
//       }
//     )
//
//     const sql2 = `
// INSERT INTO "tokens" ("id", "contract", "name", "totalSupply", "decimals", "version", "symbol", "created", "modified")
// VALUES ${tokenClauses.join(',\n')}
// ON CONFLICT DO NOTHING;`
//
//     await ground.querySingle(sql2, values)
//   }
}

function gatherNewContracts(blocks: FullBlock[]): blockchain.AnyContract[] {
  let result: blockchain.Contract[] = []
  for (let block of blocks) {
    result = result.concat(
      block.transactions
        .filter(t => t.newContract)
        .map(t => t.newContract as blockchain.AnyContract)
    )
  }
  return result
}

// function getTokenTransferContractAddresses(transactions: blockchain.ContractTransaction[]) {
//   const tempMap: any = {}
//   for (let transaction of transactions) {
//     tempMap[transaction.]
//   }
//   return tempMap.keys()
// }

interface ContractInfoNew {
  address: string
  contractId: number
  tokenId: number
  txid: string
}

async function gatherTokenTranferInfo(ground: Modeler, pairs: { address: string, txid: string }[]): Promise<ContractInfoNew[]> {
  if (pairs.length == 0)
    return Promise.resolve([])

  const addressClause = pairs.map(c => `('${c.address}', '${c.txid}')`).join(',\n')
  const sql = `
  SELECT 
    contracts.id AS "contractId",
    addresses.id AS "addressId", 
    addresses.address,
    tokens.id AS "tokenId",
    infos.column2 AS txid
  FROM addresses
  JOIN contracts ON contracts.address = addresses.id
  JOIN tokens ON tokens.contract = contracts.id
  JOIN (VALUES
  ${addressClause}
  ) infos
ON infos.column1 = addresses.address`
  const records: any[] = await ground.query(sql)
  return records.map(r => ({
    address: r.address,
    contractId: parseInt(r.contractId),
    tokenId: parseInt(r.tokenId),
    txid: r.txid
  }))
}

interface DecodedTokenTransferEvent extends blockchain.DecodedEvent {
  args: {
    to: string
    from: string
    value: BigNumber
  }
}

interface TokenTransferBundle {
  original: blockchain.BaseEvent
  decoded: DecodedTokenTransferEvent
  info: ContractInfoNew
}

async function gatherTokenTransfers(ground: Modeler, decodeEvent: blockchain.EventDecoder, events: blockchain.BaseEvent[]): Promise<TokenTransferBundle[]> {
  let contractTransactions = events.map(e => ({ address: e.address, txid: e.transactionHash }))
  const infos = await gatherTokenTranferInfo(ground, contractTransactions)
  return infos.map(info => {
    const event = events.filter(event => event.transactionHash == info.txid)[0]
    const decoded = decodeEvent(event)
    return {
      original: event,
      decoded: decoded,
      info: info
    }
  })
}

interface ContractInfo {
  blockIndex: number
  timeReceived: Date
  transactionId: number
  transactionStatus: blockchain.TransactionStatus
  txid: string
}

// async function gatherContractTransactions(ground: Modeler, tokenTransfers: TokenTransferBundle[]): Promise<ContractInfo[]> {
//   const transactionClause = tokenTransfers.map(b => "'" + b.info.txid + "'").join(',\n')
//   const sql = `
//   SELECT
//     transactions.status AS "transactionStatus",
//     transactions."timeReceived",
//     transactions.id AS "transactionId",
//     transactions."blockIndex",
//     transactions.txid
//   FROM transactions
//   WHERE transactions.txid IN (
//   ${transactionClause}
//   )`
//   const records: any[] = await ground.query(sql)
//   return records.map(r => ({
//     blockIndex: r.blockIndex,
//     timeReceived: r.timeReceived,
//     transactionId: parseInt(r.transactionId),
//     transactionStatus: r.transactionStatus,
//     txid: r.txid
//   }))
// }

async function saveTokenTransfers(ground: Modeler, tokenTransfers: TokenTransferBundle[], addresses: AddressMap) {
  if (tokenTransfers.length == 0)
    return Promise.resolve()

  // const txs = await gatherContractTransactions(ground, tokenTransfers)

  const header = 'INSERT INTO "token_transfers" ("status", "transaction", "to", "from", "amount", "currency", "created", "modified") VALUES\n'
  const transactionClauses = tokenTransfers.map(bundle => {
    const to = addresses[bundle.decoded.args.to]
    const from = addresses[bundle.decoded.args.from]
    return `(0, (SELECT tx.id FROM transactions tx WHERE tx.txid = '${bundle.info.txid}'), ${to}, ${from}, ${bundle.decoded.args.value.toString()}, ${bundle.info.tokenId}, NOW(), NOW())`
  })

  const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;'
  return ground.querySingle(sql)
}

function flatMap<A, B>(array: A[], mapper: (a: A) => B[],) {
  return array.reduce((accumulator: B[], a) =>
    accumulator.concat(mapper(a)), [])
}

async function saveFullBlocks(dao: EthereumMonitorDao, decodeTokenTransfer: blockchain.EventDecoder, blocks: FullBlock[]): Promise<void> {
  const ground = dao.ground
  const transactions = flatMap(blocks, b => b.transactions)
  const events = flatMap(transactions, t => t.events || [])

  const tokenTranfers = await gatherTokenTransfers(ground, decodeTokenTransfer, events)
  const contracts = gatherNewContracts(blocks)
  const addresses = gatherAddresses(blocks, contracts, tokenTranfers)
  const lastBlockIndex = blocks.sort((a, b) => b.index - a.index)[0].index

  await Promise.all([
      saveBlocks(ground, blocks),
      dao.lastBlockDao.setLastBlock(lastBlockIndex),
      getOrCreateAddresses(dao.ground, addresses)
        .then(() => saveTransactions(ground, blocks, addresses))
        .then(() => saveContracts(ground, contracts, addresses))
        .then(() => saveTokenTransfers(ground, tokenTranfers, addresses))
    ]
  )

  console.log('Saved blocks; count', blocks.length, 'last', lastBlockIndex)
}

export async function scanEthereumExplorerBlocks(dao: EthereumMonitorDao,
                                                 client: SingleTransactionBlockClient,
                                                 decodeTokenTransfer: blockchain.EventDecoder,
                                                 config: MonitorConfig,
                                                 profiler: Profiler = new EmptyProfiler()): Promise<any> {
  let blockIndex = await getNextBlock(dao.lastBlockDao)
  const blockQueue = new ExternalBlockQueue(client, blockIndex, config.maxConsecutiveBlocks)
  const startTime: number = Date.now()
  do {
    const elapsed = Date.now() - startTime
    // console.log('Scanning block', blockIndex, 'elapsed', elapsed)
    if (config.maxMilliseconds && elapsed > config.maxMilliseconds) {
      console.log('Reached timeout of ', elapsed, 'milliseconds')
      console.log('Canceled blocks', blockQueue.requests.map(b => b.blockIndex).join(', '))
      break
    }

    profiler.start('getBlocks')
    const blocks = await blockQueue.getBlocks()
    profiler.stop('getBlocks')
    if (blocks.length == 0) {
      console.log('No more blocks found.')
      break
    }

    console.log('Saving blocks', blocks.map(b => b.index).join(', '))

    profiler.start('saveBlocks')
    await saveFullBlocks(dao, decodeTokenTransfer, blocks)
    profiler.stop('saveBlocks')

    // console.log('Saved blocks', blocks.map(b => b.index))
  }
  while (true)

}