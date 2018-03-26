import { Collection } from 'vineyard-ground/source/collection';
import { Address, Currency, NewBlock, Block, NewTransaction, Transaction, TransactionStatus } from './types2';
export interface Scan {
    block: string;
}
export interface DepositMonitorManagerModel {
    Address: Collection<Address>;
    LastBlock: Collection<Block>;
    Transaction: Collection<Transaction>;
    ground: any;
}
export declare class DepositMonitorManager {
    model: DepositMonitorManagerModel;
    currency: Currency;
    constructor(model: DepositMonitorManagerModel, currency: Currency);
    getTransactionByTxid(txid: string): Promise<Transaction | undefined>;
    saveTransaction(transaction: NewTransaction): Promise<Transaction>;
    setTransactionStatus(transaction: Transaction, status: TransactionStatus): Promise<Transaction>;
    listPending(maxBlockIndex: number): Promise<Transaction[]>;
    getLastBlock(): Promise<Block | undefined>;
    setLastBlock(block: NewBlock): Promise<void>;
}
export declare type SingleTransactionBlockchainModel = DepositMonitorManager;
