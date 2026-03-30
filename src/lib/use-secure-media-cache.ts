"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SecureMediaAssetLike = {
  id?: string | null;
  media_asset_id?: string | null;
  delivery_url?: string | null;
  worker_url?: string | null;
  object_key?: string | null;
};

type PrefetchTask = {
  key: string;
  asset: SecureMediaAssetLike;
  priority: number;
};

function mediaCacheKey(asset: SecureMediaAssetLike | null | undefined) {
  if (!asset) {
    return null;
  }
  return asset.object_key ?? asset.worker_url ?? asset.delivery_url ?? asset.media_asset_id ?? asset.id ?? null;
}

export function useSecureMediaCache({ concurrency = 3 }: { concurrency?: number } = {}) {
  const [, setRevision] = useState(0);

  const blobCacheRef = useRef<Map<string, string>>(new Map());
  const inflightBlobRef = useRef<Map<string, Promise<string>>>(new Map());
  const queuedBlobKeysRef = useRef<Set<string>>(new Set());
  const prefetchQueueRef = useRef<PrefetchTask[]>([]);
  const activePrefetchCountRef = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      blobCacheRef.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      blobCacheRef.current.clear();
      inflightBlobRef.current.clear();
      queuedBlobKeysRef.current.clear();
      prefetchQueueRef.current = [];
    };
  }, []);

  const fetchSecureBlob = useCallback(async (asset: SecureMediaAssetLike): Promise<string> => {
    const key = mediaCacheKey(asset);
    const requestUrl = asset.delivery_url ?? asset.worker_url;
    if (!key || !requestUrl) {
      throw new Error("Secure media URL is missing");
    }

    const cached = blobCacheRef.current.get(key);
    if (cached) {
      return cached;
    }

    const inflight = inflightBlobRef.current.get(key);
    if (inflight) {
      return inflight;
    }

    const requestPromise = (async () => {
      const response = await fetch(requestUrl, {
        method: "GET",
        credentials: "include",
        cache: "force-cache",
      });
      if (!response.ok) {
        throw new Error(`Unable to load secure media (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const previousBlobUrl = blobCacheRef.current.get(key);
      if (previousBlobUrl) {
        URL.revokeObjectURL(previousBlobUrl);
      }
      blobCacheRef.current.set(key, blobUrl);
      if (!unmountedRef.current) {
        setRevision((value) => value + 1);
      }
      return blobUrl;
    })().finally(() => {
      inflightBlobRef.current.delete(key);
    });

    inflightBlobRef.current.set(key, requestPromise);
    return requestPromise;
  }, []);

  const drainPrefetchQueue = useCallback(() => {
    while (
      activePrefetchCountRef.current < concurrency &&
      prefetchQueueRef.current.length > 0
    ) {
      const nextTask = prefetchQueueRef.current.shift();
      if (!nextTask) {
        return;
      }

      activePrefetchCountRef.current += 1;
      void fetchSecureBlob(nextTask.asset)
        .catch(() => {
          // Keep the UI resilient; the visible view can retry later if needed.
        })
        .finally(() => {
          queuedBlobKeysRef.current.delete(nextTask.key);
          activePrefetchCountRef.current -= 1;
          drainPrefetchQueue();
        });
    }
  }, [concurrency, fetchSecureBlob]);

  const queuePrefetch = useCallback(
    (asset: SecureMediaAssetLike, priority = 0) => {
      const key = mediaCacheKey(asset);
      if (!key || (!asset.delivery_url && !asset.worker_url)) {
        return;
      }
      if (
        blobCacheRef.current.has(key) ||
        inflightBlobRef.current.has(key) ||
        queuedBlobKeysRef.current.has(key)
      ) {
        return;
      }

      queuedBlobKeysRef.current.add(key);
      prefetchQueueRef.current.push({
        key,
        asset,
        priority,
      });
      prefetchQueueRef.current.sort((left, right) => right.priority - left.priority);
      drainPrefetchQueue();
    },
    [drainPrefetchQueue]
  );

  const queuePrefetchMany = useCallback(
    (assets: SecureMediaAssetLike[], priorityBase = 0) => {
      assets.forEach((asset, index) => {
        queuePrefetch(asset, priorityBase - index);
      });
    },
    [queuePrefetch]
  );

  const resolveUrl = useCallback(
    (asset: SecureMediaAssetLike | null | undefined, fallback?: string | null) => {
      const key = mediaCacheKey(asset);
      if (key) {
        const cached = blobCacheRef.current.get(key);
        if (cached) {
          return cached;
        }
      }
      return asset?.delivery_url ?? asset?.worker_url ?? fallback ?? null;
    },
    []
  );

  return {
    fetchSecureBlob,
    queuePrefetch,
    queuePrefetchMany,
    resolveUrl,
  };
}
