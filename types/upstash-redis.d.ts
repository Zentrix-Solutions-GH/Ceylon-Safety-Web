// Type declaration for @upstash/redis — package not installed; declaration satisfies
// tsc when running lib/ratelimit and lib/auth which import it at module level.
// Vitest resolves the actual stub via vitest.config.ts alias at test runtime.
declare module "@upstash/redis" {
  export class Redis {
    constructor(opts: { url: string; token: string });
    pipeline(): {
      incr(key: string): this;
      expire(key: string, seconds: number): this;
      del(key: string): this;
      exec(): Promise<unknown[]>;
    };
    incr(key: string): Promise<number>;
    set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<string | null>;
    get<T = unknown>(key: string): Promise<T | null>;
    expire(key: string, seconds: number): Promise<number>;
    del(...keys: string[]): Promise<number>;
  }
}
