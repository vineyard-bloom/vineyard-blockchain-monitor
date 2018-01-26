import { Model, TransactionToSave } from "./deposit-monitor-manager";
import { AddressIdentityDelegate, BaseAddress, MonitorDao, TransactionDao } from "./types";
import { Modeler } from "vineyard-ground/source/modeler";
import { Collection } from "vineyard-ground/source/collection";
import { BaseBlock, BlockInfo, ExternalSingleTransaction as ExternalTransaction, ReadClient, SingleTransaction as Transaction } from "vineyard-blockchain";
export declare function listPendingSingleCurrencyTransactions(ground: Modeler, transactionCollection: Collection<Transaction>, maxBlockIndex: number): Promise<Transaction[]>;
export declare function saveSingleCurrencyBlock(blockCollection: Collection<BlockInfo>, block: BaseBlock): Promise<BlockInfo>;
export declare function getTransactionByTxid(transactionCollection: Collection<Transaction>, txid: string): Promise<Transaction | undefined>;
export declare function getOrCreateAddressReturningId<Identity>(addressCollection: Collection<BaseAddress<Identity>>, externalAddress: string): Promise<Identity>;
export declare function saveSingleCurrencyTransaction<AddressIdentity, BlockIdentity>(transactionCollection: Collection<Transaction>, getOrCreateAddress: AddressIdentityDelegate<AddressIdentity>, transaction: TransactionToSave): Promise<Transaction>;
export declare function createSingleCurrencyTransactionDao(model: Model): TransactionDao;
export declare function createEthereumExplorerDao(model: Model): MonitorDao;
export declare function scanEthereumExplorerBlocks(dao: MonitorDao, client: ReadClient<ExternalTransaction>): Promise<any>;
