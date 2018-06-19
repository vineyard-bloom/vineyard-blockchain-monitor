import { blockchain } from "vineyard-blockchain";
export interface BlockRequest {
    blockIndex: number;
    promise: any;
}
export interface BlockQueueConfig {
    maxSize: number;
    maxBlockRequests: number;
    minSize: number;
}
export interface IndexedBlock {
    index: number;
}
export declare class ExternalBlockQueue<Block extends IndexedBlock> {
    private blocks;
    private blockIndex;
    private highestBlockIndex;
    private client;
    private config;
    requests: BlockRequest[];
    private listeners;
    constructor(client: blockchain.BlockReader<Block>, blockIndex: number, config: Partial<BlockQueueConfig>);
    getBlockIndex(): number;
    private removeRequest;
    private removeBlocks;
    private onResponse;
    private addRequest;
    private update;
    private getConsecutiveBlocks;
    getBlocks(): Promise<Block[]>;
}
