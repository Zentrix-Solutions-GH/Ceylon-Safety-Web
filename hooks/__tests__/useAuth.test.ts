import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));

import { useAuth } from "../useAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const mockCreateClient = vi.mocked(createSupabaseBrowserClient);

function makeClient({
  session = null as unknown,
  getSessionError = null as unknown,
  signOutError = null as unknown,
  onAuthStateChangeFn = (() => {}) as (cb: unknown) => void,
} = {}) {
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue(
        getSessionError
          ? Promise.reject(getSessionError)
          : { data: { session } }
      ),
      onAuthStateChange: vi.fn().mockImplementation((cb: unknown) => {
        onAuthStateChangeFn(cb);
        return { data: { subscription: { unsubscribe } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: signOutError }),
    },
  };
  return { client, unsubscribe };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useAuth", () => {
  it("starts with isLoading=true and user=null", () => {
    const { client } = makeClient();
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("sets user from getSession when session exists", async () => {
    const session = { user: { user_metadata: { full_name: "Kamal" } } };
    const { client } = makeClient({ session });
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual({ name: "Kamal" });
  });

  it("EC1: getSession error → user=null, isLoading=false", async () => {
    const { client } = makeClient({ getSessionError: new Error("network") });
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("EC2: user_metadata has no name → name=null", async () => {
    const session = { user: { user_metadata: {} } };
    const { client } = makeClient({ session });
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual({ name: null });
  });

  it("falls back to user_metadata.name when full_name is absent", async () => {
    const session = { user: { user_metadata: { name: "Nimal" } } };
    const { client } = makeClient({ session });
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual({ name: "Nimal" });
  });

  it("onAuthStateChange fires → user and isLoading updated", async () => {
    let authCallback: ((event: string, session: unknown) => void) | null = null;
    const { client } = makeClient({
      onAuthStateChangeFn: (cb) => { authCallback = cb as typeof authCallback; },
    });
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());

    // Wait for the effect to run so authCallback is registered.
    await waitFor(() => expect(authCallback).not.toBeNull());

    await act(async () => {
      authCallback!("SIGNED_IN", {
        user: { user_metadata: { full_name: "Sunil" } },
      });
    });

    await waitFor(() => expect(result.current.user).toEqual({ name: "Sunil" }));
    expect(result.current.isLoading).toBe(false);
  });

  it("unsubscribes from onAuthStateChange on unmount", async () => {
    const { client, unsubscribe } = makeClient();
    mockCreateClient.mockReturnValue(client as never);
    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("signOut: resolves when Supabase returns no error", async () => {
    const { client } = makeClient();
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    await expect(result.current.signOut()).resolves.toBeUndefined();
  });

  it("signOut: throws when Supabase returns an error", async () => {
    const supabaseError = new Error("signOut failed");
    const { client } = makeClient({ signOutError: supabaseError });
    mockCreateClient.mockReturnValue(client as never);
    const { result } = renderHook(() => useAuth());
    await expect(result.current.signOut()).rejects.toThrow("signOut failed");
  });
});
