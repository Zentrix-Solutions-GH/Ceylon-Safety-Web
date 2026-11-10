import { describe, it, expect, vi } from "vitest";

function makeGuard({
  page,
  autoLoadUntilPage,
  hasMore,
}: {
  page: number;
  autoLoadUntilPage: number;
  hasMore: boolean;
}) {
  let inFlight = false;

  const tryLoad = async (onLoad: () => Promise<void>) => {
    if (inFlight || !hasMore || page >= autoLoadUntilPage) return false;
    inFlight = true;
    try {
      await onLoad();
      return true;
    } finally {
      inFlight = false;
    }
  };

  return { tryLoad, setInFlight: (v: boolean) => { inFlight = v; } };
}

describe("useInfiniteScroll guard logic", () => {
  it("does not call onLoad when page >= autoLoadUntilPage", async () => {
    const { tryLoad } = makeGuard({ page: 3, autoLoadUntilPage: 3, hasMore: true });
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const called = await tryLoad(onLoad);
    expect(called).toBe(false);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not call onLoad when hasMore is false", async () => {
    const { tryLoad } = makeGuard({ page: 1, autoLoadUntilPage: 3, hasMore: false });
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const called = await tryLoad(onLoad);
    expect(called).toBe(false);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not call onLoad when in-flight", async () => {
    const { tryLoad, setInFlight } = makeGuard({ page: 1, autoLoadUntilPage: 3, hasMore: true });
    setInFlight(true);
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const called = await tryLoad(onLoad);
    expect(called).toBe(false);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("calls onLoad when page < autoLoadUntilPage and hasMore and not in-flight", async () => {
    const { tryLoad } = makeGuard({ page: 1, autoLoadUntilPage: 3, hasMore: true });
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const called = await tryLoad(onLoad);
    expect(called).toBe(true);
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("releases in-flight guard after onLoad resolves", async () => {
    const { tryLoad } = makeGuard({ page: 1, autoLoadUntilPage: 3, hasMore: true });
    const onLoad = vi.fn().mockResolvedValue(undefined);
    await tryLoad(onLoad);
    const called2 = await tryLoad(onLoad);
    expect(called2).toBe(true);
    expect(onLoad).toHaveBeenCalledTimes(2);
  });
});
