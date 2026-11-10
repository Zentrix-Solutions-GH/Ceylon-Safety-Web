import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import type { UseInfiniteScrollOptions } from "@/hooks/useInfiniteScroll";

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

class MockIntersectionObserver {
  static lastCallback: IOCallback | null = null;
  static lastInstance: MockIntersectionObserver | null = null;
  static instanceCount = 0;

  observe = vi.fn();
  disconnect = vi.fn();

  constructor(cb: IOCallback) {
    MockIntersectionObserver.lastCallback = cb;
    MockIntersectionObserver.lastInstance = this;
    MockIntersectionObserver.instanceCount++;
  }

  static triggerIntersect() {
    MockIntersectionObserver.lastCallback?.([
      { isIntersecting: true } as IntersectionObserverEntry,
    ]);
  }

  static reset() {
    MockIntersectionObserver.lastCallback = null;
    MockIntersectionObserver.lastInstance = null;
    MockIntersectionObserver.instanceCount = 0;
  }
}

beforeEach(() => {
  MockIntersectionObserver.reset();
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

// ---------------------------------------------------------------------------
// Wrapper component — attaches the hook's sentinel ref to a real DOM node
// ---------------------------------------------------------------------------

function Sentinel(props: UseInfiniteScrollOptions) {
  const { ref } = useInfiniteScroll(props);
  return <div ref={ref} data-testid="sentinel" />;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useInfiniteScroll", () => {
  it("creates an observer and observes the sentinel element", () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    render(<Sentinel page={1} autoLoadUntilPage={3} hasMore={true} onLoad={onLoad} />);
    expect(MockIntersectionObserver.lastInstance).not.toBeNull();
    expect(MockIntersectionObserver.lastInstance!.observe).toHaveBeenCalledOnce();
  });

  it("disconnects the observer on unmount", () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <Sentinel page={1} autoLoadUntilPage={3} hasMore={true} onLoad={onLoad} />
    );
    const instance = MockIntersectionObserver.lastInstance!;
    unmount();
    expect(instance.disconnect).toHaveBeenCalledOnce();
  });

  it("does not call onLoad when hasMore is false", async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    render(<Sentinel page={1} autoLoadUntilPage={3} hasMore={false} onLoad={onLoad} />);
    MockIntersectionObserver.triggerIntersect();
    await Promise.resolve();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not call onLoad when page >= autoLoadUntilPage", async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    render(<Sentinel page={3} autoLoadUntilPage={3} hasMore={true} onLoad={onLoad} />);
    MockIntersectionObserver.triggerIntersect();
    await Promise.resolve();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("calls onLoad when page < autoLoadUntilPage and hasMore", async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    render(<Sentinel page={1} autoLoadUntilPage={3} hasMore={true} onLoad={onLoad} />);
    MockIntersectionObserver.triggerIntersect();
    await Promise.resolve();
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("observer is created only once — not recreated when page changes", () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <Sentinel page={1} autoLoadUntilPage={5} hasMore={true} onLoad={onLoad} />
    );
    const firstInstance = MockIntersectionObserver.lastInstance;
    expect(firstInstance).not.toBeNull();

    rerender(<Sentinel page={2} autoLoadUntilPage={5} hasMore={true} onLoad={onLoad} />);
    rerender(<Sentinel page={3} autoLoadUntilPage={5} hasMore={true} onLoad={onLoad} />);

    expect(MockIntersectionObserver.instanceCount).toBe(1);
    expect(firstInstance!.disconnect).not.toHaveBeenCalled();
  });
});
