import { ExternalTransaction, ReadClient, Currency, Block } from 'vineyard-blockchain';
import { SingleTransactionBlockchainModel } from './deposit-monitor-manager2';
import { TransactionHandler } from "./types2";
export declare class DepositMonitor {
    private model;
    private client;
    private currency;
    private minimumConfirmations;
    private transactionHandler;
    constructor(model: SingleTransactionBlockchainModel, client: ReadClient<ExternalTransaction>, currency: Currency, minimumConfirmations: number, transactionHandler: TransactionHandler);
    private convertStatus(source);
    private saveExternalTransaction(source, block);
    private saveExternalTransactions(transactions, block);
    private confirmExistingTransaction(transaction);
    private updatePendingTransaction(transaction);
    scanBlocks(): Promise<void>;
    gatherTransactions(lastBlock: Block | undefined): Promise<Block | undefined>;
    updatePendingTransactions(maxBlockIndex: number): Promise<void>;
    update(): Promise<void>;
}
