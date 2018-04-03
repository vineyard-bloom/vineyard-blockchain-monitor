import { BigNumber } from 'bignumber.js'

export type Id = string

export type Identity<T> = Id

export interface Currency {
  id: number
  name: string
}

export interface NewAddress {
  address: string
  currency: number
}

export interface Address extends NewAddress {
  id: Id
}

export interface NewBlock {
  hash: string
  index: number
  currency: number
  timeMined: Date
}

export interface Block extends NewBlock {
  id: Id
}

export interface ExternalBlock {
  hash: string
  index: number
  timeMined: Date
}

export interface FullBlock<ExternalTransaction> extends ExternalBlock {
  transactions: ExternalTransaction[]
}

export type Resolve<T> = (value: PromiseLike<T>|T|undefined) => void

export enum TransactionStatus {
  pending = 0,
  accepted = 1,
  rejected = 2,
}

export interface NewTransaction {
  txid: string
  amount: BigNumber
  timeReceived: Date
  block: number
  status: TransactionStatus
  to: string
  from: string
  currency: number
}

export interface Transaction extends NewTransaction {
  id: Id
}

export interface ExternalTransaction extends NewTransaction {
  confirmations: number
}

export interface ReadClient<ExternalTransaction> {
  getBlockIndex(): Promise<number>

  getLastBlock(): Promise<Block>

  getTransactionStatus(txid: string): Promise<TransactionStatus>

  getNextBlockInfo(block: Block | undefined): Promise<Block | undefined>

  getFullBlock(block: Block): Promise<FullBlock<ExternalTransaction> | undefined>
}

export interface BitcoinTransactionInfo {
  outputIndex: number,
  used: boolean
}

export type BitcoinTransaction = NewTransaction & BitcoinTransactionInfo

export interface BitcoinReadClient<Transaction extends BitcoinTransaction, T extends NewTransaction> extends ReadClient<T> {
  getFullBitcoinBlock(block: Block): Promise<FullBlock<Transaction> | undefined>
}

export interface WriteClient {

}

export interface TransactionHandler {
  shouldTrackTransaction(transaction: ExternalTransaction): Promise<boolean>
  onConfirm(transaction: Transaction): Promise<Transaction>
  onSave(transaction: Transaction): Promise<Transaction>
}
