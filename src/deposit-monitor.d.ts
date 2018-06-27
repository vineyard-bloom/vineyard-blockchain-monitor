import { ReadClient, Currency } from 'vineyard-blockchain';
import { SingleTransactionBlockchainModel } from './deposit-monitor-manager';
import { ExternalTransaction, TransactionHandler } from "./types";
import { LastBlock } from "./types";
export declare class DepositMonitor {
    private model;
    private client;
    private currency;
    private minimumConfirmations;
    private transactionHandler;
    constructor(model: SingleTransactionBlockchainModel, client: ReadClient<ExternalTransaction>, currency: Currency, minimumConfirmations: number, transactionHandler: TransactionHandler);
    private convertStatus(highestBlock, source);
    private saveExternalTransaction(source, blockIndex);
    private saveExternalTransactions(transactions, blockIndex);
    private confirmExistingTransaction(transaction);
    private updatePendingTransaction(transaction);
    scanBlocks(): Promise<void>;
    gatherTransactions(lastBlock: LastBlock | undefined): Promise<LastBlock | undefined>;
    updatePendingTransactions(maxBlockIndex: number): Promise<void>;
    update(): Promise<void>;
}
