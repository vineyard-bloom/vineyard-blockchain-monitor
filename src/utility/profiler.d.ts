export interface CumulativeAverage {
    sum: number;
    count: number;
}
export interface Profile {
    seconds: CumulativeAverage;
    nanoseconds: CumulativeAverage;
    timer: any;
}
export declare function getAverage(values: number[]): number;
export declare type ProfilerMap = {
    [key: string]: Profile;
};
export interface Profiler {
    start(name: string): void;
    stop(name?: string): void;
    next(name: string): void;
    log(profiles?: ProfilerMap): void;
    logFlat(): void;
}
export declare class SimpleProfiler implements Profiler {
    private profiles;
    private previous;
    start(name: string): void;
    stop(name?: string): void;
    next(name: string): void;
    private formatAverage(cumulativeAverage);
    log(profiles?: ProfilerMap): void;
    logFlat(): void;
}
export declare class EmptyProfiler implements Profiler {
    start(name: string): void;
    stop(name?: string): void;
    next(name: string): void;
    log(profiles?: ProfilerMap): void;
    logFlat(): void;
}
