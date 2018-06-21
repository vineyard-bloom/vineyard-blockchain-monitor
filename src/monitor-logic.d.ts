import { Profiler } from "./utility";
import { BlockQueueConfig, ExternalBlockQueue, IndexedBlock } from "./block-queue";
import { LastBlockDao } from "./types";
import { MonitorConfig } from "./ethereum-explorer";
import { blockchain } from "vineyard-blockchain";
import { Modeler } from "vineyard-data/legacy";
export declare enum ScannedBlockStatus {
    _new = 0,
    same = 1,
    replaced = 2
}
export declare type BlockSaver<Block extends IndexedBlock> = (blocks: Block[]) => Promise<void>;
export interface IndexedHashedBlock extends IndexedBlock {
    hash: string;
}
export declare function createBlockQueue<Block extends IndexedBlock>(lastBlockDao: LastBlockDao, client: blockchain.BlockReader<Block>, queueConfig: Partial<BlockQueueConfig>, minConfirmations: number, startingBlockIndex: number): Promise<ExternalBlockQueue<Block>>;
export interface BlockSource {
    getHighestBlockIndex(): Promise<number>;
    getBlock(index: number): Promise<blockchain.Block>;
}
export declare function compareBlockHashes<T extends IndexedHashedBlock>(ground: Modeler, blocks: T[]): PromiseLike<(IndexedHashedBlock & {
    status: ScannedBlockStatus;
})[]>;
export declare function mapBlocks<T extends IndexedHashedBlock>(fullBlocks: T[]): (s: IndexedBlock) => T;
export declare function scanBlocks<Block extends IndexedHashedBlock>(blockQueue: ExternalBlockQueue<Block>, saveFullBlocks: BlockSaver<Block>, ground: Modeler, lastBlockDao: LastBlockDao, config: MonitorConfig, profiler: Profiler): Promise<any>;
