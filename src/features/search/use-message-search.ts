"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiSearchMessages,
  type SearchResultItem,
} from "@/lib/search/client-api";
import type { SearchFiltersState } from "@/features/search/search-types";
import { connectionManager } from "@/lib/connection/manager";

const DEBOUNCE_MS = 300;

function isIdleQuery(q: string, filters: SearchFiltersState) {
  return (
    !q.trim() &&
    filters.sender === "anyone" &&
    !filters.from &&
    !filters.to &&
    filters.type === "all"
  );
}

export function useMessageSearch(args: {
  q: string;
  filters: SearchFiltersState;
  enabled: boolean;
}) {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(connectionManager.getState() === "offline");
  const [requestKey, setRequestKey] = useState(0);
  const versionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const idle = isIdleQuery(args.q, args.filters);

  useEffect(() => {
    return connectionManager.subscribe((state) => {
      setOffline(state === "offline");
    });
  }, []);

  useEffect(() => {
    if (!args.enabled || idle) {
      return;
    }
    if (offline) {
      return;
    }

    const version = ++versionRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const q = args.q.trim();

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void apiSearchMessages({
        q: q || undefined,
        sender: args.filters.sender,
        from: args.filters.from || undefined,
        to: args.filters.to || undefined,
        type: args.filters.type,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        signal: controller.signal,
      })
        .then((page) => {
          if (version !== versionRef.current) {
            return;
          }
          setResults(page.results);
          setNextCursor(page.nextCursor);
          setLoading(false);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError" || version !== versionRef.current) {
            return;
          }
          setError("Something went wrong. Try again.");
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [args.enabled, args.filters, args.q, idle, offline, requestKey]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || offline || idle) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await apiSearchMessages({
        q: args.q.trim() || undefined,
        sender: args.filters.sender,
        from: args.filters.from || undefined,
        to: args.filters.to || undefined,
        type: args.filters.type,
        cursor: nextCursor,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setResults((current) => [...current, ...page.results]);
      setNextCursor(page.nextCursor);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [args.filters, args.q, idle, loadingMore, nextCursor, offline]);

  return {
    results: idle ? [] : results,
    nextCursor: idle ? null : nextCursor,
    loading: idle ? false : loading,
    loadingMore,
    error: idle ? null : error,
    offline,
    loadMore,
    retry: () => setRequestKey((key) => key + 1),
  };
}
