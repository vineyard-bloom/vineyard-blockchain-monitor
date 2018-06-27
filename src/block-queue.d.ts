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
export declare class ExternalBlockQueue<Block> {
    private blocks;
    private blockIndex;
    private highestBlockIndex;
    private client;
    private config;
    requests: BlockRequest[];
    private listeners;
    constructor(client: blockchain.BlockReader<Block>, blockIndex: number, highestBlockIndex: number, config: Partial<BlockQueueConfig>);
    getBlockIndex(): number;
    private removeRequest(blockIndex);
    private removeBlocks(blocks);
    private onResponse(blockIndex, block);
    private addRequest(index);
    private getNextRequestCount();
    private update(requestCount);
    private getConsecutiveBlocks();
    private addListener();
    private releaseBlocks(blocks);
    getBlocks(): Promise<Block[]>;
}
