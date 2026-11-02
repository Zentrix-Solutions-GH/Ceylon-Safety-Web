// Stub for @upstash/redis — used only in test environments where the package
// is not installed. Production code uses the real package via npm.
export class Redis {
  pipeline() { return { incr: () => this, expire: () => this, del: () => this, exec: async () => [1] }; }
  incr() { return Promise.resolve(1); }
  set() { return Promise.resolve("OK"); }
  get() { return Promise.resolve(null); }
  expire() { return Promise.resolve(1); }
  del() { return Promise.resolve(1); }
}
