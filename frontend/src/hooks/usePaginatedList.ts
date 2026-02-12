import { useState, useCallback, useEffect } from "react";

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

interface UsePaginatedListReturn<T> {
  data: T[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  loadMore: () => void;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  setPagination: React.Dispatch<React.SetStateAction<PaginationMeta | null>>;
}

export function usePaginatedList<T>(
  fetchFn: (params: { limit: number; offset: number }) => Promise<PaginatedResponse<T>>,
  pageSize: number,
  deps: unknown[],
): UsePaginatedListReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (offset: number, append: boolean) => {
    try {
      if (!append) {
        setError(false);
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const response = await fetchFn({ limit: pageSize, offset });

      if (append) {
        setData((prev) => [...prev, ...response.data]);
      } else {
        setData(response.data);
      }
      setPagination(response.pagination);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load(0, false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (pagination?.hasMore && !isLoadingMore) {
      load(pagination.offset + pagination.limit, true);
    }
  }, [pagination, isLoadingMore, load]);

  return { data, pagination, isLoading, isLoadingMore, error, loadMore, setData, setPagination };
}
