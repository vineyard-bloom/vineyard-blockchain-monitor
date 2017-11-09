import { Address, BaseBlock, BaseTransaction, BlockInfo, Transaction, TransactionStatus } from "vineyard-blockchain";
import { Collection, Modeler } from "vineyard-ground";
export interface TransactionToSave extends BaseTransaction {
    status: TransactionStatus;
    currency: string;
}
export interface LastBlock {
    block: string;
    currency: string;
}
export interface Scan {
    block: string;
}
export interface Model {
    Address: Collection<Address>;
    BlockInfo: Collection<BlockInfo>;
    Transaction: Collection<Transaction>;
    LastBlock: Collection<LastBlock>;
    Scan: Collection<Scan>;
    ground: Modeler;
}
export declare class BlockchainModel {
    model: Model;
    constructor(model: Model);
    getTransactionByTxid(txid: string, currency: string): Promise<Transaction | undefined>;
    saveTransaction(transaction: TransactionToSave): Promise<Transaction>;
    setStatus(transaction: Transaction, status: TransactionStatus): Promise<Transaction>;
    listPending(currency: string, maxBlockIndex: number): Promise<Transaction[]>;
    getLastBlock(currency: string): Promise<BlockInfo | undefined>;
    setLastBlock(block: string, currency: string): Promise<LastBlock | undefined>;
    setLastBlockByHash(hash: string, currency: string): Promise<LastBlock>;
    saveBlock(block: BaseBlock): Promise<BlockInfo>;
    saveLastBlock(block: BaseBlock, currency: string): Promise<LastBlock>;
}
