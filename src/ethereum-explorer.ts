import { Address, BaseBlock, LastBlock, MonitorDao, TransactionDao } from "./types"
import { createIndexedLastBlockDao, setStatus } from "./monitor-dao"
import { blockchain } from "vineyard-blockchain"
import BigNumber from "bignumber.js"
import { EmptyProfiler, Profiler } from "./utility"
import { Collection, Modeler } from 'vineyard-data/legacy'
import { flatMap } from "./utility/index";
import {
  AddressMap,
  getOrCreateAddresses,
  saveCurrencies,
  saveEthereumBlocks,
  saveSingleTransactions
} from "./database-functions"
import { createBlockQueue, scanBlocks } from "./monitor-logic";
import { getTransactionByTxid, saveSingleCurrencyBlock } from "./explorer-helpers"

type BlockBundle = blockchain.BlockBundle<blockchain.EthereumBlock, blockchain.ContractTransaction>

export type SingleTransactionBlockClient = blockchain.BlockReader<blockchain.EthereumBlock, blockchain.ContractTransaction>

export interface EthereumTransaction extends blockchain.BlockTransaction {
  to?: number
  from?: number
  currency: string
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
  InternalTransaction: Collection<blockchain.InternalTransaction>

  ground: Modeler
}

export interface EthereumMonitorDao extends MonitorDao {
  getOrCreateAddress: AddressDelegate,
  ground: Modeler
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
      saveBlock: (block: any) => saveSingleCurrencyBlock(model.Block, block)
    },
    lastBlockDao: createIndexedLastBlockDao(model.ground, 2),
    // transactionDao: createSingleCurrencyTransactionDao(model),
    getOrCreateAddress: (externalAddress: string) => getOrCreateAddressReturningId(model.Address, externalAddress),
    ground: model.ground
  }
}

export interface OptionalMonitorConfig {
  queue: {
    maxSize: number
    minSize: number
  }
  minConfirmations?: number
  maxMilliseconds?: number
  maxBlocksPerScan?: number
  profiling?: boolean
}

export interface MonitorConfig extends OptionalMonitorConfig {
  minConfirmations: number
}

function gatherAddresses(bundles: BlockBundle[], contracts: blockchain.Contract[], tokenTransfers: TokenTransferBundle[]) {
  const addresses: AddressMap = {}
  for (let bundle of bundles) {
    for (let transaction of bundle.transactions) {
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

async function saveContracts(ground: Modeler, contracts: blockchain.TokenContract[], addresses: AddressMap): Promise<void> {
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

  // tokenContracts must be passed in as type TokenContracts, must have 'name'
  const currencyContracts = await saveCurrencies(ground, tokenContracts)

  for (const bundle of currencyContracts) {
    const token = bundle.tokenContract
    const address = addresses[token.address]
    const contractRecord = contractRecords.filter((c: any) => c.address === address)[0]
    if (!contractRecord) // Must be rescanning a block and already have a contract record
      continue

    const currency = bundle.currency
    await ground.collections.Token.create({
      id: currency.id,
      contract: contractRecord.id,
      name: token.name,
      totalSupply: token.totalSupply,
      decimals: token.decimals.toNumber(),
      version: token.version,
      symbol: token.symbol
    })
  }
}

function gatherNewContracts(blocks: BlockBundle[]): blockchain.TokenContract[] {
  let result: blockchain.TokenContract[] = []
  for (let block of blocks) {
    result = result.concat(
      block.transactions
        .filter(t => t.newContract)
        .map(t => t.newContract as blockchain.TokenContract)
    )
  }
  return result
}

interface ContractInfoNew {
  address: string
  contractId: number
  tokenId: number
  txid: string
}

async function gatherTokenTransferInfo(ground: Modeler, pairs: { address: string, txid: string }[]): Promise<ContractInfoNew[]> {
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
  const infos = await gatherTokenTransferInfo(ground, contractTransactions)
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

export interface InternalTransactionBundle {
  txid: string
  internalTransaction: blockchain.InternalTransaction
}

export function gatherInternalTransactions(transactions: blockchain.ContractTransaction[]): InternalTransactionBundle[] {
  const transactionsWithInternal = transactions.filter(transaction => transaction.internalTransactions)
  if (transactionsWithInternal.length == 0)
    return []

  return flatMap(transactionsWithInternal, transaction =>
    transaction.internalTransactions!.map(internalTransaction => {
      return {
        txid: transaction.txid,
        internalTransaction
      }
    }))
}

export async function saveInternalTransactions(ground: Modeler, internalTransactions: InternalTransactionBundle[]) {
  if (internalTransactions.length == 0)
    return Promise.resolve()

  const header = 'INSERT INTO "internal_transactions" ("transaction", "to", "from", "amount", "created", "modified") VALUES\n'
  const internalTransactionClauses = internalTransactions.map(bundle => {
    return `((SELECT transactions.id FROM transactions WHERE transactions.txid = '${bundle.txid}'), (SELECT addresses.id FROM addresses WHERE addresses.address = '${bundle.internalTransaction.to}'), (SELECT addresses.id FROM addresses WHERE addresses.address = '${bundle.internalTransaction.from}'), ${bundle.internalTransaction.amount}, NOW(), NOW())`
  })

  const sql = header + internalTransactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;'
  return ground.querySingle(sql)
}

async function saveFullBlocks(ground: Modeler, decodeTokenTransfer: blockchain.EventDecoder, bundles: BlockBundle[]): Promise<void> {
  const transactions = flatMap(bundles, b => b.transactions)
  const events = flatMap(transactions, t => t.events || [])

  const internalTransactions = gatherInternalTransactions(transactions)
  const tokenTranfers = await gatherTokenTransfers(ground, decodeTokenTransfer, events)
  const contracts = gatherNewContracts(bundles)
  const addresses = gatherAddresses(bundles, contracts, tokenTranfers)

  await Promise.all([
      saveEthereumBlocks(ground, bundles.map(b => b.block)),
      getOrCreateAddresses(ground, addresses)
        .then(() => saveSingleTransactions(ground, transactions, addresses))
        .then(() => saveContracts(ground, contracts, addresses))
        .then(() => saveTokenTransfers(ground, tokenTranfers, addresses))
        .then(() => saveInternalTransactions(ground, internalTransactions))
    ]
  )
}

export async function scanEthereumExplorerBlocks(dao: EthereumMonitorDao,
                                                 client: SingleTransactionBlockClient,
                                                 decodeTokenTransfer: blockchain.EventDecoder,
                                                 config: MonitorConfig,
                                                 profiler: Profiler = new EmptyProfiler()): Promise<any> {
  const blockQueue = await createBlockQueue(dao.lastBlockDao, client, config.queue, config.minConfirmations, 0)
  const saver = (blocks: BlockBundle[]) => saveFullBlocks(dao.ground, decodeTokenTransfer, blocks)
  return scanBlocks(blockQueue, saver, dao.ground, dao.lastBlockDao, config, profiler)
}