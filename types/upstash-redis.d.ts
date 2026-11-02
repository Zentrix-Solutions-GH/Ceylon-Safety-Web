// Type declaration for @upstash/redis — package is installed at runtime but its
// types were not resolving via tsc; this declaration satisfies the type checker.
// Vitest resolves the actual stub via vitest.config.ts alias at test runtime.
// TODO: remove this file once @upstash/redis ships its own bundled .d.ts and tsc
// resolves it from node_modules automatically (check on each major version bump).
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
