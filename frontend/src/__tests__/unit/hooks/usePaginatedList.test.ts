import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePaginatedList } from "../../../hooks/usePaginatedList";

interface TestItem {
  id: string;
}

describe("usePaginatedList", () => {
  it("should fetch initial data on mount", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: [{ id: "1" }, { id: "2" }],
      pagination: { total: 10, limit: 2, offset: 0, hasMore: true },
    });

    const { result } = renderHook(() => usePaginatedList<TestItem>(fetchFn, 2, []));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalledWith({ limit: 2, offset: 0 });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.pagination?.hasMore).toBe(true);
  });

  it("should start with isLoading=true", () => {
    const fetchFn = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => usePaginatedList<TestItem>(fetchFn, 10, []));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it("should set error on fetch failure", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => usePaginatedList<TestItem>(fetchFn, 10, []));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(true);
  });

  it("should append data on loadMore", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: "1" }],
        pagination: { total: 3, limit: 1, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        data: [{ id: "2" }],
        pagination: { total: 3, limit: 1, offset: 1, hasMore: true },
      });

    const { result } = renderHook(() => usePaginatedList<TestItem>(fetchFn, 1, []));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    expect(result.current.data[0].id).toBe("1");
    expect(result.current.data[1].id).toBe("2");
  });

  it("should not fetch more when hasMore is false", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: [{ id: "1" }],
      pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
    });

    const { result } = renderHook(() => usePaginatedList<TestItem>(fetchFn, 10, []));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    // fetchFn should only be called once (initial load)
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("should reset data when deps change", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: "1" }],
        pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
      })
      .mockResolvedValueOnce({
        data: [{ id: "2" }],
        pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
      });

    const { result, rerender } = renderHook(
      ({ deps }) => usePaginatedList<TestItem>(fetchFn, 10, deps),
      { initialProps: { deps: [1] as unknown[] } }
    );

    await waitFor(() => {
      expect(result.current.data[0]?.id).toBe("1");
    });

    rerender({ deps: [2] });

    await waitFor(() => {
      expect(result.current.data[0]?.id).toBe("2");
    });
  });
});
