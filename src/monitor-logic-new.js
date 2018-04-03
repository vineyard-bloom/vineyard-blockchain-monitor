"use strict";
// import { blockchain, BlockInfo, TransactionStatus } from "vineyard-blockchain"
// import { MonitorDao, TransactionDao } from "./types"
//
// export type TransactionDelegate = (transaction: blockchain.SingleTransaction) => Promise<void>
// export type TransactionCheck = (transaction: blockchain.SingleTransaction) => Promise<boolean>
// export type TransactionSaver = (source: blockchain.SingleTransaction, block: BlockInfo) => Promise<blockchain.SingleTransaction | undefined>
//
// async function saveExternalTransaction(dao: TransactionDao,
//                                        source: blockchain.SingleTransaction,
//                                        block: BlockInfo): Promise<blockchain.SingleTransaction | undefined> {
//   try {
//     const existing = await dao.getTransactionByTxid(source.txid)
//     if (existing) {
//       return existing
//     }
//   }
//   catch (error) {
//     console.error('Error checking for existing transaction', error, source)
//     return undefined
//   }
//
//   try {
//     await dao.saveTransaction({
//       txid: source.txid,
//       to: source.to,
//       from: source.from,
//       status: TransactionStatus.accepted,
//       amount: source.amount,
//       timeReceived: source.timeReceived,
//       block: block.id
//     })
//   }
//   catch (error) {
//     console.error('Error saving transaction', error, source)
//     return undefined
//   }
// }
//
// async function confirmExistingTransaction(dao: MonitorDao, transaction: blockchain.SingleTransaction): Promise<blockchain.SingleTransaction> {
//   transaction.status = TransactionStatus.accepted
//   return await dao.transactionDao.setStatus(transaction, TransactionStatus.accepted)
// }
//
// async function isReadyToConfirm(dao: MonitorDao, transaction: blockchain.SingleTransaction): Promise<boolean> {
//   const transactionFromDatabase = await dao.transactionDao.getTransactionByTxid(transaction.txid)
//   return !!transactionFromDatabase && transactionFromDatabase.status == TransactionStatus.pending
// }
//
// async function updatePendingTransactions(dao: MonitorDao, onConfirm: TransactionDelegate, currency: number,
//                                          maxBlockIndex: number): Promise<any> {
//   const transactions = await dao.transactionDao.listPendingTransactions(maxBlockIndex)
//   for (let transaction of transactions) {
//     try {
//       if (await isReadyToConfirm(dao, transaction)) {
//         const externalTransaction = await confirmExistingTransaction(dao, transaction)
//         await onConfirm(externalTransaction)
//       }
//     }
//     catch (error) {
//       console.error('Bitcoin Transaction Pending Error', error, transaction)
//     }
//   }
// }
//
// export async function scanBlock(dao: MonitorDao, client: blockchain.ReadClient<blockchain.SingleTransaction>) {
//   const block = await client.getBlockIndex()
//
// }
//
// export async function scanExplorerBlocks(dao: MonitorDao,
//                                          client: blockchain.ReadClient<blockchain.SingleTransaction>): Promise<any> {
//   let lastBlock = await dao.lastBlockDao.getLastBlock()
//   do {
//     const blockInfo = await client.getNextBlockInfo(lastBlock)
//     if (!blockInfo)
//       return
//
//     const fullBlock = await client.getFullBlock(blockInfo)
//     if (!fullBlock) {
//       console.error('Invalid block', blockInfo)
//       return undefined
//     }
//     const block = await dao.blockDao.saveBlock({
//       hash: fullBlock.hash,
//       index: fullBlock.index,
//       timeMined: fullBlock.timeMined
//     })
//     if (!fullBlock.transactions) {
//       return block
//     }
//
//     for (let transaction of fullBlock.transactions) {
//       saveExternalTransaction(dao.transactionDao, transaction, block)
//     }
//
//     await dao.lastBlockDao.setLastBlock(block.id)
//     lastBlock = block
//   } while (true)
// }
//# sourceMappingURL=monitor-logic-new.js.map