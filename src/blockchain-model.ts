import {Address, BaseBlock, BaseTransaction, BlockInfo, Transaction, TransactionStatus} from "vineyard-blockchain"
import {Collection, Modeler} from "vineyard-ground"

export interface TransactionToSave extends BaseTransaction {
  status: TransactionStatus,
  currency: string
}

export interface LastBlock {
  block: string,
  currency: string
}

export interface Scan {
  block: string
}

export interface Model {
  Address: Collection<Address>
  BlockInfo: Collection<BlockInfo>
  Transaction: Collection<Transaction>
  LastBlock: Collection<LastBlock>
  Scan: Collection<Scan>

  ground: Modeler
}

export class BlockchainModel {
  model: Model

  constructor(model: Model) {
    this.model = model;
  }

  async getTransactionByTxid(txid: string, currency: string): Promise<Transaction | undefined> {
    return await this.model.Transaction.first(
      {
        txid: txid,
        currency: currency
      }).exec()
  }

  async saveTransaction(transaction: TransactionToSave): Promise<Transaction> {
    return await this.model.Transaction.create(transaction)
  }

  async setStatus(transaction: Transaction, status: TransactionStatus): Promise<Transaction> {
    return await this.model.Transaction.update(transaction, {
      status: status
    })
  }

  async listPending(currency: string, maxBlockIndex: number): Promise<Transaction[]> {
    const sql = `
    SELECT transactions.* FROM transactions
    JOIN block_infos ON block_infos.id = transactions.block
    AND block_infos.index < :maxBlockIndex
    WHERE status = 1 AND transactions.currency = :currency`

    return await this.model.ground.query(sql, {
      maxBlockIndex: maxBlockIndex,
      currency: currency
    })
  }

  async getLastBlock(currency: string): Promise<BlockInfo | undefined> {
    const last = await this.model.LastBlock.first({currency: currency}).exec()
    if (!last)
      return last

    return await this.model.BlockInfo.first({id: last.block}).exec()
  }

  async setLastBlock(block: string, currency: string) {
    const exists = await this.getLastBlock(currency)
    if(exists) {
      return await this.model.LastBlock.update({block: block}, {currency: currency})
    } else {
      await this.model.LastBlock.create({block: block})
    }
  }

  async setLastBlockByHash(hash: string, currency: string) {
    const block = await this.model.BlockInfo.first({hash: hash}).exec()
    return await this.model.LastBlock.update({block: block}, {currency: currency})
  }

  async saveBlock(block: BaseBlock): Promise<BlockInfo> {
    const filter = block.hash
      ? {currency: block.currency, hash: block.hash}
      : {currency: block.currency, index: block.index}

    const existing = await this.model.BlockInfo.first(filter)
    if (existing)
      return existing;

    return await this.model.BlockInfo.create(block)
  }

  async saveLastBlock(block: BaseBlock, currency: string): Promise<LastBlock> {
    let lastBlock: any
    lastBlock.block = block
    lastBlock.currency = currency
    return await this.model.LastBlock.create(lastBlock)
  }
}