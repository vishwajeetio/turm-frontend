"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { PropertyFeedCard, type PropertyFeedCardMediaSlide } from "@/components/property-feed-card";
import { useAuth } from "@/components/providers/auth-provider";
import { SiteLogoLink } from "@/components/site-logo-link";
import {
  TenantFeedCard as TenantFeedCardView,
  type TenantFeedCardSection,
} from "@/components/tenant-feed-card";
import {
  getListingFeed,
  getSearchPreferences,
  getTenantFeed,
  listMyListings,
  loadMoreListingMedia,
  refreshListingFeedToken,
  refreshTenantFeedToken,
  swipeListing,
  swipeTenant,
  upsertSearchPreferences
} from "@/lib/api";
import type {
  FeedCard,
  FeedCardMedia,
  FeedResponse,
  ManagedListingCardResponse,
  TenantFeedCard,
  TenantFeedResponse,
  TenantSearchPreferenceUpsert
} from "@/lib/types";
import { formatCompactNumber, formatCurrency, splitCsv, uniqueId } from "@/lib/utils";

type FeedWindowKind = "listing" | "tenant";

type FeedWindowContext = {
  kind: FeedWindowKind;
  scopeId: string;
  feedToken: string;
  feedTokenExpiresAt: string;
};

type ListingDeckCard = FeedCard & {
  window_id: string;
};

type TenantDeckCard = TenantFeedCard & {
  window_id: string;
};

type PrefetchTask = {
  key: string;
  media: FeedCardMedia;
  windowId: string;
  priority: number;
};

type SwipeDirection = "left" | "right";

type UndoSlot =
  | {
      mode: "listing";
      card: ListingDeckCard;
      movedDirection: SwipeDirection;
    }
  | {
      mode: "tenant";
      card: TenantDeckCard;
      movedDirection: SwipeDirection;
    };

type SwipeMotion = {
  id: string;
  mode: FeedWindowKind;
  outDirection: SwipeDirection;
  inDirection: SwipeDirection;
  isUndo: boolean;
  listingOutgoing: ListingDeckCard | null;
  listingIncoming: ListingDeckCard | null;
  tenantOutgoing: TenantDeckCard | null;
  tenantIncoming: TenantDeckCard | null;
};

type ActionFlash = {
  id: string;
  kind: "like" | "pass" | "undo";
  label: string;
};

type LimitModalState = {
  action: "like" | "pass" | "undo";
  message: string;
};

type InteractionUsage = {
  like: number;
  pass: number;
  undo: number;
};

type InteractionLimits = {
  like: number | null;
  pass: number | null;
  undo: number | null;
  canUndo: boolean;
};

type TenantFeedFilters = {
  listing_ids: string[];
  min_salary_inr: number | null;
  max_salary_inr: number | null;
  employment_types: string[];
  min_residents: number | null;
  max_residents: number | null;
  max_distance_km: number | null;
};

const EMPLOYMENT_FILTER_OPTIONS = [
  "Full time",
  "Self employed",
  "Student",
  "Contract",
  "Business owner",
  "Remote worker"
];

function defaultPreferences(tenantProfileId: string): TenantSearchPreferenceUpsert {
  return {
    tenant_profile_id: tenantProfileId,
    preferred_localities: [],
    property_types: [],
    furnishing_types: [],
    parking_required: false,
    only_verified_listings: false,
    only_owner_listings: false,
    ranking_weights: {},
    amenity_ids: [],
    extra_data: {}
  };
}

function defaultTenantFeedFilters(): TenantFeedFilters {
  return {
    listing_ids: [],
    min_salary_inr: null,
    max_salary_inr: null,
    employment_types: [],
    min_residents: null,
    max_residents: null,
    max_distance_km: null
  };
}

function selectableTenantFeedListingIds(listings: ManagedListingCardResponse[]) {
  const activeIds = listings
    .filter((listing) => listing.status === "ACTIVE")
    .map((listing) => listing.listing_id);
  if (activeIds.length) {
    return activeIds;
  }
  return listings
    .filter((listing) => listing.status !== "DRAFT")
    .map((listing) => listing.listing_id);
}

function mediaCacheKey(media: FeedCardMedia) {
  return media.object_key ?? media.worker_url ?? media.media_asset_id;
}

function isEditableNode(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function wrapListingCards(response: FeedResponse): ListingDeckCard[] {
  return response.cards.map((card) => ({
    ...card,
    window_id: response.window_id
  }));
}

function wrapTenantCards(response: TenantFeedResponse): TenantDeckCard[] {
  return response.cards.map((card) => ({
    ...card,
    window_id: response.window_id
  }));
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function numberFlag(flags: Record<string, unknown>, key: string): number | null {
  const value = flags[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.floor(value));
}

function buildInteractionLimits(
  planCode: "FREE" | "PREMIUM" | undefined,
  featureFlags: Record<string, unknown>
): InteractionLimits {
  const normalizedPlan = planCode ?? "FREE";
  const canUndo = normalizedPlan === "PREMIUM";

  const explicitLikeLimit = numberFlag(featureFlags, "daily_like_limit");
  const explicitPassLimit = numberFlag(featureFlags, "daily_pass_limit");
  const explicitUndoLimit = numberFlag(featureFlags, "daily_undo_limit");

  const like = normalizedPlan === "PREMIUM" ? explicitLikeLimit ?? 220 : explicitLikeLimit ?? 40;
  const pass = normalizedPlan === "PREMIUM" ? explicitPassLimit ?? 360 : explicitPassLimit ?? 80;
  const undo = canUndo ? explicitUndoLimit ?? 90 : 0;

  return {
    like,
    pass,
    undo,
    canUndo
  };
}

function FeedIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function FeedScreen() {
  const searchParams = useSearchParams();
  const { activeRole, dashboard, loading, logout, session, setActiveRole } = useAuth();

  const [tenantPreferences, setTenantPreferences] =
    useState<TenantSearchPreferenceUpsert | null>(null);
  const [listingCards, setListingCards] = useState<ListingDeckCard[]>([]);
  const [tenantCards, setTenantCards] = useState<TenantDeckCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [myListings, setMyListings] = useState<ManagedListingCardResponse[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sessionId] = useState(() => uniqueId("feed"));
  const [error, setError] = useState<string | null>(null);
  const [currentListingImageIndex, setCurrentListingImageIndex] = useState(0);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileListingDetailsExpanded, setMobileListingDetailsExpanded] = useState(false);
  const [tenantFeedFilters, setTenantFeedFilters] = useState<TenantFeedFilters>(
    defaultTenantFeedFilters
  );
  const [tenantFeedFilterDraft, setTenantFeedFilterDraft] = useState<TenantFeedFilters>(
    defaultTenantFeedFilters
  );
  const [undoSlot, setUndoSlot] = useState<UndoSlot | null>(null);
  const [swipeMotion, setSwipeMotion] = useState<SwipeMotion | null>(null);
  const [actionFlash, setActionFlash] = useState<ActionFlash | null>(null);
  const [limitModal, setLimitModal] = useState<LimitModalState | null>(null);
  const [usage, setUsage] = useState<InteractionUsage>({ like: 0, pass: 0, undo: 0 });

  const tenantProfile = dashboard?.tenant_profile ?? null;
  const listingRepresentativeMode = activeRole === "OWNER" || activeRole === "BROKER";
  const hasTenantAccess =
    Boolean(dashboard?.roles.includes("TENANT")) || dashboard?.user.default_role === "TENANT";
  const hasListerAccess =
    Boolean(dashboard?.roles.includes("OWNER")) ||
    Boolean(dashboard?.roles.includes("BROKER")) ||
    dashboard?.user.default_role === "OWNER" ||
    dashboard?.user.default_role === "BROKER";
  const menuItems = [
    { href: "/", label: "Feed" },
    { href: "/messages", label: "Messages" },
    { href: "/likes", label: "Likes" },
    { href: "/plan", label: "Plan" },
    ...(hasListerAccess ? [{ href: "/properties", label: "Properties" }] : []),
    ...(hasTenantAccess ? [{ href: "/profile", label: "Profile" }] : []),
    { href: "/settings", label: "Settings" }
  ];
  const requestedListingId = searchParams.get("listingId");
  const visibleListingCards = listingCards.slice(0, 3);
  const visibleTenantCards = tenantCards.slice(0, 3);
  const currentListingCard = visibleListingCards[0] ?? null;
  const currentTenantCard = visibleTenantCards[0] ?? null;
  const eligibleTenantListingIds = useMemo(
    () => selectableTenantFeedListingIds(myListings),
    [myListings]
  );
  const selectedTenantListingIds = useMemo(() => {
    if (tenantFeedFilters.listing_ids.length) {
      return tenantFeedFilters.listing_ids;
    }
    if (selectedListingId) {
      return [selectedListingId];
    }
    return eligibleTenantListingIds;
  }, [eligibleTenantListingIds, selectedListingId, tenantFeedFilters.listing_ids]);
  const tenantSelectableListings = useMemo(
    () => myListings.filter((listing) => eligibleTenantListingIds.includes(listing.listing_id)),
    [eligibleTenantListingIds, myListings]
  );

  const motionTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const windowContextsRef = useRef<Map<string, FeedWindowContext>>(new Map());
  const windowRefreshRef = useRef<Map<string, Promise<string>>>(new Map());
  const loadMoreRef = useRef<Map<string, Promise<void>>>(new Map());
  const tenantOffsetsRef = useRef<Map<string, number>>(new Map());
  const blobCacheRef = useRef<Map<string, string>>(new Map());
  const inflightBlobRef = useRef<Map<string, Promise<string>>>(new Map());
  const queuedBlobKeysRef = useRef<Set<string>>(new Set());
  const prefetchQueueRef = useRef<PrefetchTask[]>([]);
  const listingCardsRef = useRef<ListingDeckCard[]>([]);
  const tenantCardsRef = useRef<TenantDeckCard[]>([]);
  const tenantFeedFiltersRef = useRef<TenantFeedFilters>(defaultTenantFeedFilters());
  const selectedListingIdRef = useRef<string | null>(null);
  const activePrefetchCountRef = useRef(0);
  const unmountedRef = useRef(false);

  const blockSecureSurfaceAction = useCallback((event: { preventDefault: () => void; target: EventTarget | null }) => {
    if (isEditableNode(event.target)) {
      return;
    }
    event.preventDefault();
  }, []);

  const featureFlags =
    (dashboard?.active_subscription.feature_flags as Record<string, unknown> | undefined) ?? {};
  const interactionLimits = useMemo(
    () =>
      buildInteractionLimits(
        dashboard?.active_subscription.plan_code,
        featureFlags
      ),
    [dashboard?.active_subscription.plan_code, featureFlags]
  );

  const usageStorageKey = useMemo(() => {
    if (!dashboard?.user.id) {
      return null;
    }
    return `turm.feed.usage.${dashboard.user.id}.${todayKey()}`;
  }, [dashboard?.user.id]);
  const dashboardUserId = dashboard?.user.id ?? null;

  const filterStorageKey = useMemo(() => {
    if (!tenantProfile?.id) {
      return null;
    }
    return `turm.feed.filters.${tenantProfile.id}`;
  }, [tenantProfile?.id]);

  const tenantFilterStorageKey = useMemo(() => {
    if (!dashboard?.user.id) {
      return null;
    }
    return `turm.feed.tenant-filters.${dashboard.user.id}`;
  }, [dashboard?.user.id]);

  const rememberListingWindow = useCallback(
    (tenantProfileId: string, response: FeedResponse) => {
      windowContextsRef.current.set(response.window_id, {
        kind: "listing",
        scopeId: tenantProfileId,
        feedToken: response.feed_token,
        feedTokenExpiresAt: response.feed_token_expires_at
      });
      return wrapListingCards(response);
    },
    []
  );

  const rememberTenantWindow = useCallback(
    (listingId: string, response: TenantFeedResponse) => {
      windowContextsRef.current.set(response.window_id, {
        kind: "tenant",
        scopeId: listingId,
        feedToken: response.feed_token,
        feedTokenExpiresAt: response.feed_token_expires_at
      });
      return wrapTenantCards(response);
    },
    []
  );

  const pruneUnusedWindows = useCallback((windowIds: string[]) => {
    const activeWindowIds = new Set(windowIds);
    for (const windowId of Array.from(windowContextsRef.current.keys())) {
      if (!activeWindowIds.has(windowId)) {
        windowContextsRef.current.delete(windowId);
      }
    }
  }, []);

  const ensureWindowToken = useCallback(
    async (windowId: string, force = false) => {
      if (!session) {
        throw new Error("Session is required");
      }
      const windowContext = windowContextsRef.current.get(windowId);
      if (!windowContext) {
        throw new Error("Feed window is no longer active");
      }

      const expiresAt = new Date(windowContext.feedTokenExpiresAt).getTime();
      if (!force && expiresAt - Date.now() > 12_000) {
        return windowContext.feedToken;
      }

      const existingRefresh = windowRefreshRef.current.get(windowId);
      if (existingRefresh) {
        return existingRefresh;
      }

      const refreshPromise = (async () => {
        const refreshed =
          windowContext.kind === "listing"
            ? await refreshListingFeedToken(session, windowContext.scopeId, windowId)
            : await refreshTenantFeedToken(session, windowContext.scopeId, windowId);
        windowContextsRef.current.set(windowId, {
          ...windowContext,
          feedToken: refreshed.feed_token,
          feedTokenExpiresAt: refreshed.feed_token_expires_at
        });
        return refreshed.feed_token;
      })().finally(() => {
        windowRefreshRef.current.delete(windowId);
      });

      windowRefreshRef.current.set(windowId, refreshPromise);
      return refreshPromise;
    },
    [session]
  );

  const fetchSecureBlob = useCallback(
    async (media: FeedCardMedia, windowId: string, retry = true): Promise<string> => {
      const key = mediaCacheKey(media);
      const cached = blobCacheRef.current.get(key);
      if (cached) {
        return cached;
      }
      const inflight = inflightBlobRef.current.get(key);
      if (inflight) {
        return inflight;
      }
      const requestUrl = media.worker_url ?? media.delivery_url;
      if (!requestUrl) {
        throw new Error("Secure media URL is missing");
      }

      const requestPromise = (async () => {
        const feedToken = media.worker_url ? await ensureWindowToken(windowId) : null;
        const response = await fetch(requestUrl, {
          method: "GET",
          credentials: "include",
          headers: feedToken
            ? {
                Authorization: `Bearer ${feedToken}`
              }
            : undefined,
          cache: "force-cache"
        });

        if (media.worker_url && response.status === 401 && retry) {
          await ensureWindowToken(windowId, true);
          return fetchSecureBlob(media, windowId, false);
        }
        if (!response.ok) {
          throw new Error(`Unable to load secure media (${response.status})`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobCacheRef.current.set(key, blobUrl);
        if (!unmountedRef.current) {
          setMediaRevision((value) => value + 1);
        }
        return blobUrl;
      })().finally(() => {
        inflightBlobRef.current.delete(key);
      });

      inflightBlobRef.current.set(key, requestPromise);
      return requestPromise;
    },
    [ensureWindowToken]
  );

  const drainPrefetchQueue = useCallback(() => {
    while (activePrefetchCountRef.current < 3 && prefetchQueueRef.current.length > 0) {
      const nextTask = prefetchQueueRef.current.shift();
      if (!nextTask) {
        return;
      }
      activePrefetchCountRef.current += 1;
      void fetchSecureBlob(nextTask.media, nextTask.windowId)
        .catch(() => {
          // The active card will retry if the user reaches this image.
        })
        .finally(() => {
          queuedBlobKeysRef.current.delete(nextTask.key);
          activePrefetchCountRef.current -= 1;
          drainPrefetchQueue();
        });
    }
  }, [fetchSecureBlob]);

  const queuePrefetch = useCallback(
    (media: FeedCardMedia, windowId: string, priority: number) => {
      const key = mediaCacheKey(media);
      if ((!media.worker_url && !media.delivery_url) || blobCacheRef.current.has(key) || inflightBlobRef.current.has(key)) {
        return;
      }
      if (queuedBlobKeysRef.current.has(key)) {
        return;
      }
      queuedBlobKeysRef.current.add(key);
      prefetchQueueRef.current.push({
        key,
        media,
        windowId,
        priority
      });
      prefetchQueueRef.current.sort((left, right) => right.priority - left.priority);
      drainPrefetchQueue();
    },
    [drainPrefetchQueue]
  );

  const primeVisibleCard = useCallback(
    async (card: ListingDeckCard | TenantDeckCard | null) => {
      if (!card?.media[0]) {
        return;
      }
      await fetchSecureBlob(card.media[0], card.window_id).catch(() => {
        // Keep the feed resilient even if the first secure fetch fails.
      });
    },
    [fetchSecureBlob]
  );

  const scheduleVisiblePrefetch = useCallback(() => {
    if (listingRepresentativeMode) {
      visibleTenantCards.forEach((card, cardIndex) => {
        const priorityBase = cardIndex === 0 ? 300 : cardIndex === 1 ? 220 : 140;
        const onlyPrimary = card.media.slice(0, 1);
        onlyPrimary.forEach((media, mediaIndex) => {
          queuePrefetch(media, card.window_id, priorityBase - mediaIndex);
        });
      });
      return;
    }

    const prefetchDepthByCardIndex = [6, 3, 2];
    visibleListingCards.forEach((card, cardIndex) => {
      const priorityBase = cardIndex === 0 ? 360 : cardIndex === 1 ? 240 : 140;
      const limit = prefetchDepthByCardIndex[cardIndex] ?? 0;
      card.media.slice(0, limit).forEach((media, mediaIndex) => {
        queuePrefetch(media, card.window_id, priorityBase - mediaIndex);
      });
    });
  }, [listingRepresentativeMode, queuePrefetch, visibleListingCards, visibleTenantCards]);

  const getCachedMediaUrl = useCallback((media: FeedCardMedia | undefined | null) => {
    if (!media) {
      return null;
    }
    return blobCacheRef.current.get(mediaCacheKey(media)) ?? null;
  }, []);

  const updateUsage = useCallback(
    (updater: (current: InteractionUsage) => InteractionUsage) => {
      setUsage((current) => {
        const next = updater(current);
        if (usageStorageKey && typeof window !== "undefined") {
          window.localStorage.setItem(usageStorageKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [usageStorageKey]
  );

  const showActionFlash = useCallback((kind: ActionFlash["kind"], label: string) => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setActionFlash({
      id: uniqueId("flash"),
      kind,
      label
    });
    flashTimerRef.current = window.setTimeout(() => {
      setActionFlash(null);
      flashTimerRef.current = null;
    }, 850);
  }, []);

  const startSwipeMotion = useCallback((motion: Omit<SwipeMotion, "id">) => {
    if (motionTimerRef.current) {
      window.clearTimeout(motionTimerRef.current);
      motionTimerRef.current = null;
    }
    setSwipeMotion({
      ...motion,
      id: uniqueId("motion")
    });
    motionTimerRef.current = window.setTimeout(() => {
      setSwipeMotion(null);
      motionTimerRef.current = null;
    }, 360);
  }, []);

  const ensureActionAllowed = useCallback(
    (kind: "like" | "pass" | "undo") => {
      if (kind === "undo" && !interactionLimits.canUndo) {
        setLimitModal({
          action: "undo",
          message: "Undo is a Premium feature. Upgrade your plan to unlock rewinds."
        });
        return false;
      }
      const limit = interactionLimits[kind];
      if (limit !== null && usage[kind] >= limit) {
        setLimitModal({
          action: kind,
          message:
            kind === "like"
              ? "You have reached the current plan limit for likes today. Upgrade to keep liking."
              : kind === "pass"
                ? "You have reached the current plan limit for dislikes today. Upgrade to keep disliking."
                : "You have reached the current plan limit for undo today. Upgrade to continue using undo."
        });
        return false;
      }
      setLimitModal(null);
      return true;
    },
    [interactionLimits, usage]
  );

  const loadTenantPreferences = useCallback(async () => {
    if (!session || !tenantProfile) {
      return;
    }
    const response = await getSearchPreferences(session, tenantProfile.id);
    if (filterStorageKey && typeof window !== "undefined") {
      const storedRaw = window.sessionStorage.getItem(filterStorageKey);
      if (storedRaw) {
        try {
          const parsed = JSON.parse(storedRaw) as Partial<TenantSearchPreferenceUpsert>;
          setTenantPreferences({
            ...response,
            ...parsed,
            tenant_profile_id: tenantProfile.id
          });
          return;
        } catch {
          // ignore corrupted local filter cache
        }
      }
    }
    setTenantPreferences(response);
  }, [filterStorageKey, session, tenantProfile]);

  const loadListingQueue = useCallback(
    async (
      mode: "reset" | "append" = "reset",
      options?: { excludeListingIds?: string[] }
    ) => {
      if (!session || !tenantProfile) {
        return;
      }
      const excludeListingIds =
        mode === "append"
          ? (options?.excludeListingIds ?? listingCardsRef.current.map((card) => card.listing_id))
          : [];
      const response = await getListingFeed(session, {
        tenant_profile_id: tenantProfile.id,
        offset: 0,
        limit: 3,
        exclude_listing_ids: excludeListingIds,
        session_id: sessionId
      });
      const nextCards = rememberListingWindow(tenantProfile.id, response);
      await primeVisibleCard(nextCards[0] ?? null);
      setListingCards((current) => {
        const incomingCards = mode === "reset" ? nextCards : [...current, ...nextCards];
        const byListingId = new Map<string, ListingDeckCard>();
        for (const card of incomingCards) {
          if (!byListingId.has(card.listing_id)) {
            byListingId.set(card.listing_id, card);
          }
        }
        const mergedCards = Array.from(byListingId.values());
        pruneUnusedWindows(mergedCards.map((card) => card.window_id));
        return mergedCards;
      });
      if (mode === "reset") {
        setCurrentListingImageIndex(0);
        setUndoSlot(null);
      }
    },
    [
      rememberListingWindow,
      primeVisibleCard,
      pruneUnusedWindows,
      session,
      sessionId,
      tenantProfile
    ]
  );

  const loadRepresentativeListings = useCallback(async () => {
    if (!session || !listingRepresentativeMode) {
      return;
    }
    const listings = await listMyListings(session);
    setMyListings(listings);
    const eligibleIds = selectableTenantFeedListingIds(listings);
    setSelectedListingId((current) => current ?? eligibleIds[0] ?? listings[0]?.listing_id ?? null);
    setTenantFeedFilters((current) => ({
      ...current,
      listing_ids: current.listing_ids.length ? current.listing_ids : eligibleIds
    }));
  }, [listingRepresentativeMode, session]);

  const loadTenantQueue = useCallback(
    async (
      mode: "reset" | "append" = "reset",
      options?: { listing_ids?: string[]; filters?: TenantFeedFilters }
    ) => {
      const activeFilters = options?.filters ?? tenantFeedFiltersRef.current;
      const activeListingIds = (options?.listing_ids ?? activeFilters.listing_ids).filter(Boolean);
      const activeListingId =
        activeListingIds[0] ?? selectedListingIdRef.current;
      const excludeTenantProfileIds =
        mode === "append"
          ? tenantCardsRef.current.map((card) => card.tenant_profile_id)
          : [];
      if (!session || !activeListingId) {
        return;
      }
      if (activeListingIds.length <= 1) {
        const response = await getTenantFeed(session, {
          listing_id: activeListingId,
          offset: mode === "reset" ? 0 : (tenantOffsetsRef.current.get(activeListingId) ?? 0),
          limit: 3,
          exclude_tenant_profile_ids: excludeTenantProfileIds,
          session_id: sessionId,
          min_salary_inr: activeFilters.min_salary_inr,
          max_salary_inr: activeFilters.max_salary_inr,
          employment_types: activeFilters.employment_types,
          min_residents: activeFilters.min_residents,
          max_residents: activeFilters.max_residents,
          max_distance_km: activeFilters.max_distance_km
        });
        const nextCards = rememberTenantWindow(activeListingId, response);
        await primeVisibleCard(nextCards[0] ?? null);
        setTenantCards((current) => {
          const mergedCards = mode === "reset" ? nextCards : [...current, ...nextCards];
          pruneUnusedWindows(mergedCards.map((card) => card.window_id));
          return mergedCards;
        });
        tenantOffsetsRef.current.set(activeListingId, response.next_offset);
        if (mode === "reset") {
          setUndoSlot(null);
        }
        return;
      }

      const responses = await Promise.all(
        activeListingIds.map((listingId) =>
          getTenantFeed(session, {
            listing_id: listingId,
            offset: mode === "reset" ? 0 : (tenantOffsetsRef.current.get(listingId) ?? 0),
            limit: 3,
            exclude_tenant_profile_ids: excludeTenantProfileIds,
            session_id: sessionId,
            min_salary_inr: activeFilters.min_salary_inr,
            max_salary_inr: activeFilters.max_salary_inr,
            employment_types: activeFilters.employment_types,
            min_residents: activeFilters.min_residents,
            max_residents: activeFilters.max_residents,
            max_distance_km: activeFilters.max_distance_km
          }).then((response) => ({ listingId, response }))
        )
      );

      const collectedCards: TenantDeckCard[] = [];
      for (const { listingId, response } of responses) {
        tenantOffsetsRef.current.set(listingId, response.next_offset);
        collectedCards.push(...rememberTenantWindow(listingId, response));
      }

      const deduped = new Map<string, TenantDeckCard>();
      for (const card of collectedCards.sort((left, right) => right.match_score - left.match_score)) {
        if (!deduped.has(card.tenant_profile_id)) {
          deduped.set(card.tenant_profile_id, card);
        }
      }
      const nextCards = Array.from(deduped.values());
      await primeVisibleCard(nextCards[0] ?? null);
      setTenantCards((current) => {
        const incoming = mode === "reset" ? nextCards : [...current, ...nextCards];
        const byProfile = new Map<string, TenantDeckCard>();
        for (const card of incoming) {
          if (!byProfile.has(card.tenant_profile_id)) {
            byProfile.set(card.tenant_profile_id, card);
          }
        }
        const mergedCards = Array.from(byProfile.values());
        pruneUnusedWindows(mergedCards.map((card) => card.window_id));
        return mergedCards;
      });
      if (mode === "reset") {
        setUndoSlot(null);
      }
    },
    [
      primeVisibleCard,
      pruneUnusedWindows,
      rememberTenantWindow,
      session,
      sessionId
    ]
  );

  const maybeLoadMoreListingImages = useCallback(
    async (card: ListingDeckCard, currentIndex: number) => {
      if (!session || !tenantProfile) {
        return;
      }
      if (card.image_count_total <= card.media.length) {
        return;
      }
      const remainingLoadedImages = card.media.length - currentIndex - 1;
      if (remainingLoadedImages > 6) {
        return;
      }

      const existingLoad = loadMoreRef.current.get(card.listing_id);
      if (existingLoad) {
        await existingLoad;
        return;
      }

      const loadPromise = (async () => {
        await ensureWindowToken(card.window_id);
        const response = await loadMoreListingMedia(session, {
          tenant_profile_id: tenantProfile.id,
          listing_id: card.listing_id,
          window_id: card.window_id
        });

        const windowContext = windowContextsRef.current.get(card.window_id);
        if (windowContext) {
          windowContextsRef.current.set(card.window_id, {
            ...windowContext,
            feedToken: response.feed_token,
            feedTokenExpiresAt: response.feed_token_expires_at
          });
        }

        setListingCards((current) =>
          current.map((item) =>
            item.listing_id === response.listing_id
              ? {
                  ...item,
                  media: response.media,
                  preload_image_count: response.loaded_image_count
                }
              : item
          )
        );
      })().finally(() => {
        loadMoreRef.current.delete(card.listing_id);
      });

      loadMoreRef.current.set(card.listing_id, loadPromise);
      await loadPromise;
    },
    [ensureWindowToken, session, tenantProfile]
  );

  useEffect(() => {
    listingCardsRef.current = listingCards;
  }, [listingCards]);

  useEffect(() => {
    tenantCardsRef.current = tenantCards;
  }, [tenantCards]);

  useEffect(() => {
    tenantFeedFiltersRef.current = tenantFeedFilters;
  }, [tenantFeedFilters]);

  useEffect(() => {
    selectedListingIdRef.current = selectedListingId;
  }, [selectedListingId]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      for (const blobUrl of blobCacheRef.current.values()) {
        URL.revokeObjectURL(blobUrl);
      }
      blobCacheRef.current.clear();
      inflightBlobRef.current.clear();
      prefetchQueueRef.current = [];
      queuedBlobKeysRef.current.clear();
      windowContextsRef.current.clear();
      tenantOffsetsRef.current.clear();
      if (motionTimerRef.current) {
        window.clearTimeout(motionTimerRef.current);
      }
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!usageStorageKey || typeof window === "undefined") {
      setUsage({ like: 0, pass: 0, undo: 0 });
      return;
    }
    const raw = window.localStorage.getItem(usageStorageKey);
    if (!raw) {
      setUsage({ like: 0, pass: 0, undo: 0 });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<InteractionUsage>;
      setUsage({
        like: Number(parsed.like ?? 0),
        pass: Number(parsed.pass ?? 0),
        undo: Number(parsed.undo ?? 0)
      });
    } catch {
      setUsage({ like: 0, pass: 0, undo: 0 });
    }
  }, [usageStorageKey]);

  useEffect(() => {
    if (!tenantFilterStorageKey || typeof window === "undefined") {
      setTenantFeedFilters(defaultTenantFeedFilters());
      return;
    }
    const raw = window.sessionStorage.getItem(tenantFilterStorageKey);
    if (!raw) {
      setTenantFeedFilters(defaultTenantFeedFilters());
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<TenantFeedFilters>;
      const legacyListingId =
        typeof (parsed as { listing_id?: unknown }).listing_id === "string"
          ? ((parsed as { listing_id?: string }).listing_id ?? null)
          : null;
      setTenantFeedFilters({
        listing_ids: Array.isArray(parsed.listing_ids)
          ? parsed.listing_ids.filter((value): value is string => typeof value === "string")
          : legacyListingId
            ? [legacyListingId]
            : [],
        min_salary_inr:
          typeof parsed.min_salary_inr === "number" ? Math.max(parsed.min_salary_inr, 0) : null,
        max_salary_inr:
          typeof parsed.max_salary_inr === "number" ? Math.max(parsed.max_salary_inr, 0) : null,
        employment_types: Array.isArray(parsed.employment_types)
          ? parsed.employment_types.filter((value): value is string => typeof value === "string")
          : [],
        min_residents:
          typeof parsed.min_residents === "number" ? Math.max(parsed.min_residents, 0) : null,
        max_residents:
          typeof parsed.max_residents === "number" ? Math.max(parsed.max_residents, 0) : null,
        max_distance_km:
          typeof parsed.max_distance_km === "number"
            ? Math.max(parsed.max_distance_km, 0)
            : null
      });
    } catch {
      setTenantFeedFilters(defaultTenantFeedFilters());
    }
  }, [tenantFilterStorageKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (isEditableNode(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (["s", "c", "x", "u", "p"].includes(key)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!tenantFilterStorageKey || typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(tenantFilterStorageKey, JSON.stringify(tenantFeedFilters));
  }, [tenantFeedFilters, tenantFilterStorageKey]);

  useEffect(() => {
    if (!session || !dashboardUserId || !activeRole) {
      return;
    }
    setError(null);
    if (activeRole === "TENANT" && tenantProfile) {
      void loadTenantPreferences();
      void loadListingQueue("reset");
    }
    if (listingRepresentativeMode) {
      void loadRepresentativeListings();
    }
  }, [
    activeRole,
    dashboardUserId,
    listingRepresentativeMode,
    loadListingQueue,
    loadRepresentativeListings,
    loadTenantPreferences,
    session,
    tenantProfile
  ]);

  useEffect(() => {
    if (!listingRepresentativeMode) {
      return;
    }
    if (!selectedTenantListingIds.length) {
      return;
    }
    void loadTenantQueue("reset");
  }, [listingRepresentativeMode, loadTenantQueue, selectedTenantListingIds]);

  useEffect(() => {
    setError(null);
  }, [session]);

  useEffect(() => {
    if (!listingRepresentativeMode) {
      return;
    }
    const firstSelected = tenantFeedFilters.listing_ids[0] ?? null;
    if (firstSelected && firstSelected !== selectedListingId) {
      setSelectedListingId(firstSelected);
    }
  }, [listingRepresentativeMode, selectedListingId, tenantFeedFilters.listing_ids]);

  useEffect(() => {
    if (!listingRepresentativeMode || !myListings.length) {
      return;
    }
    const validIds = tenantFeedFilters.listing_ids.filter((listingId) =>
      eligibleTenantListingIds.includes(listingId)
    );
    const fallbackIds = eligibleTenantListingIds;
    if (!validIds.length) {
      setTenantFeedFilters((current) => ({
        ...current,
        listing_ids: fallbackIds
      }));
      return;
    }
    if (validIds.length !== tenantFeedFilters.listing_ids.length) {
      setTenantFeedFilters((current) => ({
        ...current,
        listing_ids: validIds
      }));
    }
  }, [eligibleTenantListingIds, listingRepresentativeMode, myListings, tenantFeedFilters.listing_ids]);

  useEffect(() => {
    if (!listingRepresentativeMode || !requestedListingId) {
      return;
    }
    if (!myListings.some((item) => item.listing_id === requestedListingId)) {
      return;
    }
    setSelectedListingId(requestedListingId);
    setTenantFeedFilters((current) => ({
      ...current,
      listing_ids: [requestedListingId]
    }));
  }, [listingRepresentativeMode, myListings, requestedListingId]);

  useEffect(() => {
    setCurrentListingImageIndex(0);
  }, [currentListingCard?.listing_id]);

  useEffect(() => {
    scheduleVisiblePrefetch();
  }, [mediaRevision, scheduleVisiblePrefetch]);

  useEffect(() => {
    if (!currentListingCard) {
      return;
    }
    const currentMedia =
      currentListingCard.media[
        Math.min(currentListingImageIndex, Math.max(currentListingCard.media.length - 1, 0))
      ];
    if (currentMedia) {
      void fetchSecureBlob(currentMedia, currentListingCard.window_id).catch(() => {
        // The card already has a placeholder fallback.
      });
    }
    void maybeLoadMoreListingImages(currentListingCard, currentListingImageIndex);
  }, [
    currentListingCard,
    currentListingImageIndex,
    fetchSecureBlob,
    maybeLoadMoreListingImages
  ]);

  const saveFiltersAndRefresh = useCallback(async () => {
    if (!session || !tenantProfile || !tenantPreferences) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertSearchPreferences(session, tenantPreferences);
      if (filterStorageKey && typeof window !== "undefined") {
        window.sessionStorage.setItem(filterStorageKey, JSON.stringify(tenantPreferences));
      }
      await loadListingQueue("reset");
      setFilterOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save filters");
    } finally {
      setBusy(false);
    }
  }, [filterStorageKey, loadListingQueue, session, tenantPreferences, tenantProfile]);

  const applyTenantFiltersAndRefresh = useCallback(async () => {
    if (!listingRepresentativeMode || !session) {
      return;
    }
    const nextFilters: TenantFeedFilters = {
      ...tenantFeedFilterDraft,
      listing_ids: tenantFeedFilterDraft.listing_ids.filter((value) => value.trim().length > 0),
      employment_types: tenantFeedFilterDraft.employment_types.filter((value) => value.trim().length > 0)
    };
    if (!nextFilters.listing_ids.length) {
      setError("Select at least one listing to browse tenants.");
      return;
    }
    const activeListingId = nextFilters.listing_ids[0];
    setBusy(true);
    setError(null);
    try {
      const committedFilters = nextFilters;
      setTenantFeedFilters(committedFilters);
      setSelectedListingId(activeListingId);
      await loadTenantQueue("reset", {
        listing_ids: committedFilters.listing_ids,
        filters: committedFilters
      });
      setFilterOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to apply tenant filters");
    } finally {
      setBusy(false);
    }
  }, [
    listingRepresentativeMode,
    loadTenantQueue,
    session,
    tenantFeedFilterDraft
  ]);

  const openFilterPanel = useCallback(() => {
    if (listingRepresentativeMode) {
      setTenantFeedFilterDraft(tenantFeedFilters);
    }
    setFilterOpen(true);
  }, [listingRepresentativeMode, tenantFeedFilters]);

  const runListingSwipe = useCallback(
    async (action: "LIKE" | "PASS") => {
      if (!session || !tenantProfile || !currentListingCard || busy) {
        return;
      }

      const usageKey: "like" | "pass" = action === "LIKE" ? "like" : "pass";
      if (!ensureActionAllowed(usageKey)) {
        return;
      }

      const previousCards = listingCards;
      const previousUndo = undoSlot;
      const outgoing = currentListingCard;
      const remainingCards = listingCards.slice(1);
      const incoming = remainingCards[0] ?? null;
      const movedDirection: SwipeDirection = action === "LIKE" ? "right" : "left";

      updateUsage((current) => ({
        ...current,
        [usageKey]: current[usageKey] + 1
      }));
      setBusy(true);
      setError(null);
      setUndoSlot({
        mode: "listing",
        card: outgoing,
        movedDirection
      });
      startSwipeMotion({
        mode: "listing",
        outDirection: movedDirection,
        inDirection: movedDirection === "right" ? "left" : "right",
        isUndo: false,
        listingOutgoing: outgoing,
        listingIncoming: incoming,
        tenantOutgoing: null,
        tenantIncoming: null
      });
      setListingCards(remainingCards);
      pruneUnusedWindows(remainingCards.map((card) => card.window_id));
      setCurrentListingImageIndex(0);

      try {
        await swipeListing(session, {
          tenant_profile_id: tenantProfile.id,
          tenant_user_id: dashboard?.user.id ?? "",
          listing_id: outgoing.listing_id,
          action,
          source_session_id: sessionId
        });
        showActionFlash(action === "LIKE" ? "like" : "pass", action === "LIKE" ? "Liked" : "Disliked");

        if (remainingCards.length <= 2) {
          await loadListingQueue("append", {
            excludeListingIds: remainingCards.map((card) => card.listing_id)
          });
        }
      } catch (nextError) {
        updateUsage((current) => ({
          ...current,
          [usageKey]: Math.max(current[usageKey] - 1, 0)
        }));
        setListingCards(previousCards);
        pruneUnusedWindows(previousCards.map((card) => card.window_id));
        setUndoSlot(previousUndo);
        setError(nextError instanceof Error ? nextError.message : "Unable to save swipe");
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      currentListingCard,
      dashboard?.user.id,
      ensureActionAllowed,
      listingCards,
      loadListingQueue,
      pruneUnusedWindows,
      session,
      sessionId,
      showActionFlash,
      startSwipeMotion,
      tenantProfile,
      undoSlot,
      updateUsage
    ]
  );

  const runTenantSwipe = useCallback(
    async (action: "LIKE" | "PASS") => {
      if (!session || !selectedTenantListingIds.length || !currentTenantCard || busy) {
        return;
      }

      const usageKey: "like" | "pass" = action === "LIKE" ? "like" : "pass";
      if (!ensureActionAllowed(usageKey)) {
        return;
      }

      const previousCards = tenantCards;
      const previousUndo = undoSlot;
      const outgoing = currentTenantCard;
      const remainingCards = tenantCards.slice(1);
      const incoming = remainingCards[0] ?? null;
      const movedDirection: SwipeDirection = action === "LIKE" ? "right" : "left";

      updateUsage((current) => ({
        ...current,
        [usageKey]: current[usageKey] + 1
      }));
      setBusy(true);
      setError(null);
      setUndoSlot({
        mode: "tenant",
        card: outgoing,
        movedDirection
      });
      startSwipeMotion({
        mode: "tenant",
        outDirection: movedDirection,
        inDirection: movedDirection === "right" ? "left" : "right",
        isUndo: false,
        listingOutgoing: null,
        listingIncoming: null,
        tenantOutgoing: outgoing,
        tenantIncoming: incoming
      });
      setTenantCards(remainingCards);
      pruneUnusedWindows(remainingCards.map((card) => card.window_id));

      try {
        const swipeResults = await Promise.allSettled(
          selectedTenantListingIds.map((listingId) =>
            swipeTenant(session, {
              listing_id: listingId,
              tenant_profile_id: outgoing.tenant_profile_id,
              acted_by_user_id: dashboard?.user.id ?? "",
              action,
              source_session_id: sessionId
            })
          )
        );
        if (swipeResults.every((result) => result.status === "rejected")) {
          throw new Error("Unable to save this tenant action for selected listings.");
        }
        showActionFlash(action === "LIKE" ? "like" : "pass", action === "LIKE" ? "Liked" : "Disliked");

        if (remainingCards.length <= 2) {
          await loadTenantQueue("append");
        }
      } catch (nextError) {
        updateUsage((current) => ({
          ...current,
          [usageKey]: Math.max(current[usageKey] - 1, 0)
        }));
        setTenantCards(previousCards);
        pruneUnusedWindows(previousCards.map((card) => card.window_id));
        setUndoSlot(previousUndo);
        setError(nextError instanceof Error ? nextError.message : "Unable to save swipe");
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      currentTenantCard,
      dashboard?.user.id,
      ensureActionAllowed,
      loadTenantQueue,
      pruneUnusedWindows,
      selectedTenantListingIds,
      session,
      sessionId,
      showActionFlash,
      startSwipeMotion,
      tenantCards,
      undoSlot,
      updateUsage
    ]
  );

  const runUndo = useCallback(async () => {
    if (!undoSlot || busy) {
      return;
    }
    if (listingRepresentativeMode && undoSlot.mode !== "tenant") {
      return;
    }
    if (!listingRepresentativeMode && undoSlot.mode !== "listing") {
      return;
    }
    if (!ensureActionAllowed("undo")) {
      return;
    }

    updateUsage((current) => ({
      ...current,
      undo: current.undo + 1
    }));

    if (undoSlot.mode === "listing") {
      const outgoing = currentListingCard;
      const incoming = undoSlot.card;
      const outDirection: SwipeDirection = undoSlot.movedDirection === "right" ? "left" : "right";
      startSwipeMotion({
        mode: "listing",
        outDirection,
        inDirection: undoSlot.movedDirection,
        isUndo: true,
        listingOutgoing: outgoing,
        listingIncoming: incoming,
        tenantOutgoing: null,
        tenantIncoming: null
      });
      setListingCards((current) => [incoming, ...current]);
      setCurrentListingImageIndex(0);
      showActionFlash("undo", "Previous listing");
      setUndoSlot(null);
      return;
    }

    const outgoing = currentTenantCard;
    const incoming = undoSlot.card;
    const outDirection: SwipeDirection = undoSlot.movedDirection === "right" ? "left" : "right";
    startSwipeMotion({
      mode: "tenant",
      outDirection,
      inDirection: undoSlot.movedDirection,
      isUndo: true,
      listingOutgoing: null,
      listingIncoming: null,
      tenantOutgoing: outgoing,
      tenantIncoming: incoming
    });
    setTenantCards((current) => [incoming, ...current]);
    showActionFlash("undo", "Previous profile");
    setUndoSlot(null);
  }, [
    busy,
    currentListingCard,
    currentTenantCard,
    ensureActionAllowed,
    listingRepresentativeMode,
    showActionFlash,
    startSwipeMotion,
    undoSlot,
    updateUsage
  ]);

  function handleListingMediaWheel(event: WheelEvent<HTMLDivElement>) {
    if (!currentListingCard || currentListingCard.media.length <= 1) {
      return;
    }
    if (Math.abs(event.deltaY) < 24) {
      return;
    }
    event.preventDefault();
    setCurrentListingImageIndex((current) => {
      const nextIndex =
        event.deltaY > 0
          ? Math.min(current + 1, currentListingCard.media.length - 1)
          : Math.max(current - 1, 0);
      return nextIndex;
    });
  }

  const pageLabel = "Feed";
  const isPro = dashboard?.active_subscription.plan_code === "PREMIUM";
  const undoEnabledForMode =
    !!undoSlot &&
    ((undoSlot.mode === "listing" && !listingRepresentativeMode) ||
      (undoSlot.mode === "tenant" && listingRepresentativeMode));
  const secureShellProps = {
    onContextMenu: blockSecureSurfaceAction,
    onCopy: blockSecureSurfaceAction,
    onCut: blockSecureSurfaceAction,
    onDragStart: blockSecureSurfaceAction,
  };

  const renderListingCard = (card: ListingDeckCard | null, staticPreview = false) => {
    if (!card) {
      return (
        <div className="ultra-feed-empty-card">
          <strong>No property cards available.</strong>
          <span>Adjust filters or refresh the deck.</span>
        </div>
      );
    }

    const imageFallback = "https://placehold.co/980x1280/0d1117/e6ecf3?text=Property";
    const slides: PropertyFeedCardMediaSlide[] = card.media.map((media, index) => ({
      id: media.media_asset_id,
      src: getCachedMediaUrl(media) ?? media.delivery_url ?? imageFallback,
      alt: index === 0 ? card.headline : `${card.headline} image ${index + 1}`,
      roomTag: media.room_category,
      customTag: media.caption,
    }));

    return (
      <PropertyFeedCard
        activeImageIndex={
          staticPreview
            ? 0
            : Math.min(currentListingImageIndex, Math.max(card.media.length - 1, 0))
        }
        chips={[
          `${card.bhk} BHK`,
          card.furnishing_type.replaceAll("_", " "),
          `${formatCurrency(card.monthly_rent_inr)} / month`,
          `Deposit ${formatCurrency(card.security_deposit_inr)}`,
        ]}
        fallbackReason="Fresh listing in your active filter window."
        headline={card.headline}
        localityLine={`${card.locality ? `${card.locality}, ` : ""}${card.city}, ${card.state}`}
        media={slides}
        mobileDetailsExpanded={staticPreview ? false : mobileListingDetailsExpanded}
        onImageIndexChange={(next) => {
          if (staticPreview) {
            return;
          }
          setCurrentListingImageIndex(next);
        }}
        onMediaWheel={staticPreview ? undefined : handleListingMediaWheel}
        onMobileDetailsExpandedChange={(next) => {
          if (!staticPreview) {
            setMobileListingDetailsExpanded(next);
          }
        }}
        reasons={card.reasons}
        reasonsTitle="Why this matched"
        score={{ value: `${Math.round(card.match_score)}%`, label: "match" }}
        stats={[
          { label: "Budget fit", value: `${Math.round(card.budget_score)}%` },
          { label: "Location fit", value: `${Math.round(card.location_score)}%` },
          { label: "Amenities fit", value: `${Math.round(card.amenity_score)}%` },
          { label: "Lifestyle fit", value: `${Math.round(card.lifestyle_score)}%` },
        ]}
        disableMediaControls={staticPreview}
      />
    );
  };

  const renderTenantCard = (card: TenantDeckCard | null, staticPreview = false) => {
    if (!card) {
      return (
        <div className="ultra-feed-empty-card">
          <strong>No tenant cards available.</strong>
          <span>Publish listings to unlock tenant recommendations.</span>
        </div>
      );
    }

    const profileImage =
      getCachedMediaUrl(card.media[0]) ??
      card.media[0]?.delivery_url ??
      "https://placehold.co/900x1200/0d1117/e6ecf3?text=Tenant";

    const sections: TenantFeedCardSection[] = [
      {
        title: "Preferences",
        items: [
          `Preferred localities: ${card.preferred_localities.join(", ") || "Open to nearby areas"}`,
          `Languages: ${card.languages.join(", ") || "Not specified"}`,
          `Food preference: ${card.food_preference || "Not specified"}`,
          `Smoking preference: ${card.smoking_preference || "Not specified"}`,
        ],
      },
      {
        title: "Why this matched",
        items: card.reasons.length
          ? card.reasons
          : ["This tenant profile is inside your secure three-card feed window."],
      },
    ];

    if (card.about_lifestyle) {
      sections.push({
        title: "About lifestyle",
        body: card.about_lifestyle,
      });
    }

    return (
      <TenantFeedCardView
        avatarAlt={card.full_name}
        avatarSrc={profileImage}
        chips={[
          card.occupation || "Tenant profile",
          `${card.family_size ?? 1} ${(card.family_size ?? 1) === 1 ? "resident" : "residents"}`,
          `Move-in ${card.preferred_move_in_date || "Flexible"}`,
          `Stay ${card.preferred_stay_months ?? "-"} months`,
          `Pets ${card.has_pets ? "Yes" : "No"}`,
        ]}
        headline={card.full_name}
        mobileDetailsExpanded={staticPreview ? false : mobileListingDetailsExpanded}
        onMobileDetailsExpandedChange={(next) => {
          if (!staticPreview) {
            setMobileListingDetailsExpanded(next);
          }
        }}
        score={{ value: `${Math.round(card.match_score)}%`, label: "tenant fit" }}
        sections={sections}
        stats={[
          { label: "Completion", value: `${formatCompactNumber(card.completion_score)}%` },
          { label: "Location fit", value: `${Math.round(card.location_score)}%` },
          { label: "Lifestyle fit", value: `${Math.round(card.lifestyle_score)}%` },
          { label: "Verification", value: `${Math.round(card.verification_score)}%` },
        ]}
        subheadline={`${card.occupation || "Tenant"}${card.employer_name ? ` · ${card.employer_name}` : ""}`}
      />
    );
  };

  const renderAnimatedLayers = () => {
    if (!swipeMotion) {
      return null;
    }

    const modeMatchesCurrent =
      (swipeMotion.mode === "listing" && !listingRepresentativeMode) ||
      (swipeMotion.mode === "tenant" && listingRepresentativeMode);

    if (!modeMatchesCurrent) {
      return null;
    }

    if (swipeMotion.mode === "listing") {
      return (
        <>
          <div className={`ultra-feed-motion-layer ultra-feed-motion-out-${swipeMotion.outDirection}`}>
            {renderListingCard(swipeMotion.listingOutgoing, true)}
          </div>
          <div className={`ultra-feed-motion-layer ultra-feed-motion-in-${swipeMotion.inDirection}`}>
            {renderListingCard(swipeMotion.listingIncoming, true)}
          </div>
        </>
      );
    }

    return (
      <>
        <div className={`ultra-feed-motion-layer ultra-feed-motion-out-${swipeMotion.outDirection}`}>
          {renderTenantCard(swipeMotion.tenantOutgoing, true)}
        </div>
        <div className={`ultra-feed-motion-layer ultra-feed-motion-in-${swipeMotion.inDirection}`}>
          {renderTenantCard(swipeMotion.tenantIncoming, true)}
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="ultra-feed-shell ultra-feed-shell-locked" {...secureShellProps}>
        <div className="ultra-feed-empty-card ultra-feed-empty-full">
          <strong>Loading feed...</strong>
          <span>Syncing session, secure windows, and recommendation state.</span>
        </div>
      </div>
    );
  }

  if (!session || !dashboard) {
    return (
      <div className="ultra-feed-shell ultra-feed-shell-locked" {...secureShellProps}>
        <header className="ultra-feed-header">
          <SiteLogoLink brandLabel="Turm" pageLabel="Secure preview mode" />
        </header>

        <main className="ultra-feed-main">
          <section className="ultra-feed-card-stage ultra-feed-card-stage-static">
            <div className="ultra-feed-empty-card">
              <strong>Login required.</strong>
              <span>Feed cards, likes, messages, and private media stay available only after OTP login.</span>
              <Link className="ultra-feed-primary-button" href="/login">
                Go to login
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="ultra-feed-shell ultra-feed-shell-locked" {...secureShellProps}>
      <DashboardHeader
        activeRole={activeRole}
        brandLabel={isPro ? "PRO" : "Turm"}
        headerActions={({ closeMenu }) =>
          ((!listingRepresentativeMode && tenantProfile) || listingRepresentativeMode) ? (
            <button
              aria-label="Open filters"
              className="ultra-feed-icon-button ultra-feed-header-action-button"
              onClick={() => {
                closeMenu();
                openFilterPanel();
              }}
              type="button"
            >
              <FeedIcon path="M3 5a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2h-6.2l-2.2 4.4V18a1 1 0 0 1-1.45.9l-2-1A1 1 0 0 1 8 17v-6.6L5.8 6H4a1 1 0 0 1-1-1z" />
              <span className="ultra-feed-action-label">Filters</span>
            </button>
          ) : null
        }
        navItems={menuItems}
        onLogout={logout}
        onMenuOpenChange={(open) => {
          if (open) {
            setFilterOpen(false);
          }
        }}
        onRoleChange={setActiveRole}
        roles={dashboard?.roles ?? []}
        showFeedButton={false}
        showMessagesButton
        title={pageLabel}
      />

      <main className="ultra-feed-main">
        {error ? <div className="ultra-feed-alert">{error}</div> : null}

        {!listingRepresentativeMode && !tenantProfile ? (
          <div className="ultra-feed-empty-card">
            <strong>Create your tenant profile first.</strong>
            <span>Feed opens after profile photo + baseline preferences.</span>
            <Link className="ultra-feed-primary-button" href="/profile">
              Complete profile
            </Link>
          </div>
        ) : null}

        {listingRepresentativeMode && !myListings.length ? (
          <div className="ultra-feed-empty-card">
            <strong>Create at least one listing to discover tenants.</strong>
            <span>Tenant recommendations start after listing publish.</span>
            <Link className="ultra-feed-primary-button" href="/properties">
              Open properties
            </Link>
          </div>
        ) : null}

        <section className="ultra-feed-card-stage">
          {renderAnimatedLayers()}

          {swipeMotion ? null : listingRepresentativeMode ? renderTenantCard(currentTenantCard) : renderListingCard(currentListingCard)}

          <div className="ultra-feed-floating-actions ultra-feed-floating-actions-stage">
            <button
              className={`ultra-feed-action-button ultra-feed-action-undo ${
                undoEnabledForMode && interactionLimits.canUndo ? "" : "is-disabled"
              }`}
              aria-label="Previous listing"
              onClick={() => void runUndo()}
              type="button"
            >
              <FeedIcon path="M6.84 7.66H14a6 6 0 1 1-4.24 10.24 1 1 0 1 1 1.42-1.42A4 4 0 1 0 14 9.66H6.84l2.34 2.34a1 1 0 1 1-1.42 1.42l-4.05-4.05a1 1 0 0 1 0-1.42L7.76 4a1 1 0 1 1 1.42 1.42L6.84 7.66z" />
            </button>

            <button
              className="ultra-feed-action-button ultra-feed-action-pass"
              aria-label="Dislike listing"
              disabled={busy || !(listingRepresentativeMode ? currentTenantCard : currentListingCard)}
              onClick={() => void (listingRepresentativeMode ? runTenantSwipe("PASS") : runListingSwipe("PASS"))}
              type="button"
            >
              <FeedIcon path="M6.22 6.22a1 1 0 0 1 1.41 0L12 10.59l4.37-4.37a1 1 0 0 1 1.41 1.41L13.41 12l4.37 4.37a1 1 0 0 1-1.41 1.41L12 13.41l-4.37 4.37a1 1 0 0 1-1.41-1.41L10.59 12 6.22 7.63a1 1 0 0 1 0-1.41z" />
            </button>

            <button
              className="ultra-feed-action-button ultra-feed-action-like"
              aria-label="Like listing"
              disabled={busy || !(listingRepresentativeMode ? currentTenantCard : currentListingCard)}
              onClick={() => void (listingRepresentativeMode ? runTenantSwipe("LIKE") : runListingSwipe("LIKE"))}
              type="button"
            >
              <FeedIcon path="M12.1 20.3a1 1 0 0 1-.9 0C7.2 18.4 3 14.7 3 9.8 3 6.6 5.4 4 8.4 4c1.5 0 2.9.7 3.8 1.9A4.8 4.8 0 0 1 16 4c3 0 5.4 2.6 5.4 5.8 0 4.9-4.2 8.6-8.3 10.5z" />
            </button>
          </div>
        </section>
      </main>

      {actionFlash ? (
        <div className={`ultra-feed-action-flash ultra-feed-action-flash-${actionFlash.kind}`}>
          {actionFlash.label}
        </div>
      ) : null}

      {limitModal ? (
        <div className="ultra-feed-limit-modal-backdrop">
          <div className="ultra-feed-limit-modal">
            <h3>Plan limit reached</h3>
            <p>{limitModal.message}</p>
            <div className="ultra-feed-limit-modal-actions">
              <button
                className="ultra-feed-secondary-button"
                onClick={() => setLimitModal(null)}
                type="button"
              >
                Continue
              </button>
              <Link className="ultra-feed-primary-button" href="/pricing" onClick={() => setLimitModal(null)}>
                Upgrade plan
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!listingRepresentativeMode && tenantPreferences ? (
        <div className={`ultra-feed-filter-sheet ${filterOpen ? "is-open" : ""}`}>
          <div className="ultra-feed-filter-card">
            <header>
              <h2>Filters</h2>
              <button
                aria-label="Close filters"
                className="ultra-feed-icon-button"
                onClick={() => setFilterOpen(false)}
                type="button"
              >
                <FeedIcon path="M6.22 6.22a1 1 0 0 1 1.41 0L12 10.59l4.37-4.37a1 1 0 0 1 1.41 1.41L13.41 12l4.37 4.37a1 1 0 0 1-1.41 1.41L12 13.41l-4.37 4.37a1 1 0 0 1-1.41-1.41L10.59 12 6.22 7.63a1 1 0 0 1 0-1.41z" />
              </button>
            </header>

            <div className="ultra-feed-filter-grid">
              <label>
                <span>City</span>
                <input
                  value={tenantPreferences.city ?? ""}
                  onChange={(event) =>
                    setTenantPreferences((current) => ({
                      ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                      city: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Localities</span>
                <input
                  placeholder="Indiranagar, Koramangala"
                  value={(tenantPreferences.preferred_localities ?? []).join(", ")}
                  onChange={(event) =>
                    setTenantPreferences((current) => ({
                      ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                      preferred_localities: splitCsv(event.target.value)
                    }))
                  }
                />
              </label>

              <label>
                <span>Max rent</span>
                <input
                  inputMode="numeric"
                  value={tenantPreferences.max_rent_inr ?? ""}
                  onChange={(event) =>
                    setTenantPreferences((current) => ({
                      ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                      max_rent_inr: Number(event.target.value) || null
                    }))
                  }
                />
              </label>

              <label>
                <span>Max brokerage %</span>
                <input
                  inputMode="decimal"
                  value={tenantPreferences.max_brokerage_percentage ?? ""}
                  onChange={(event) =>
                    setTenantPreferences((current) => ({
                      ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                      max_brokerage_percentage: Number(event.target.value) || null
                    }))
                  }
                />
              </label>
            </div>

            <div className="ultra-feed-chip-row">
              <button
                className={`ultra-feed-chip-button ${
                  tenantPreferences.only_verified_listings ? "is-active" : ""
                }`}
                onClick={() =>
                  setTenantPreferences((current) => ({
                    ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                    only_verified_listings: !current?.only_verified_listings
                  }))
                }
                type="button"
              >
                Verified only
              </button>
              <button
                className={`ultra-feed-chip-button ${
                  tenantPreferences.only_owner_listings ? "is-active" : ""
                }`}
                onClick={() =>
                  setTenantPreferences((current) => ({
                    ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                    only_owner_listings: !current?.only_owner_listings
                  }))
                }
                type="button"
              >
                Owner only
              </button>
              <button
                className={`ultra-feed-chip-button ${
                  tenantPreferences.parking_required ? "is-active" : ""
                }`}
                onClick={() =>
                  setTenantPreferences((current) => ({
                    ...(current ?? defaultPreferences(tenantProfile?.id ?? "")),
                    parking_required: !current?.parking_required
                  }))
                }
                type="button"
              >
                Parking required
              </button>
            </div>

            <footer>
              <button className="ultra-feed-secondary-button" onClick={() => setFilterOpen(false)} type="button">
                Cancel
              </button>
              <button className="ultra-feed-primary-button" onClick={() => void saveFiltersAndRefresh()} type="button">
                Apply filters
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {listingRepresentativeMode ? (
        <div className={`ultra-feed-filter-sheet ${filterOpen ? "is-open" : ""}`}>
          <div className="ultra-feed-filter-card">
            <header>
              <h2>Tenant filters</h2>
              <button
                aria-label="Close tenant filters"
                className="ultra-feed-icon-button"
                onClick={() => setFilterOpen(false)}
                type="button"
              >
                <FeedIcon path="M6.22 6.22a1 1 0 0 1 1.41 0L12 10.59l4.37-4.37a1 1 0 0 1 1.41 1.41L13.41 12l4.37 4.37a1 1 0 0 1-1.41 1.41L12 13.41l-4.37 4.37a1 1 0 0 1-1.41-1.41L10.59 12 6.22 7.63a1 1 0 0 1 0-1.41z" />
              </button>
            </header>

            <div className="ultra-feed-filter-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                <span>Target listings (select at least one)</span>
                <div className="ultra-feed-chip-row">
                  <button
                    className={`ultra-feed-chip-button ${
                      tenantFeedFilterDraft.listing_ids.length ===
                      tenantSelectableListings.length
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() =>
                      setTenantFeedFilterDraft((current) => ({
                        ...current,
                        listing_ids: tenantSelectableListings.map((listing) => listing.listing_id)
                      }))
                    }
                    type="button"
                  >
                    All active listings
                  </button>
                  {tenantSelectableListings.map((listing) => {
                      const active = tenantFeedFilterDraft.listing_ids.includes(listing.listing_id);
                      return (
                        <button
                          className={`ultra-feed-chip-button ${active ? "is-active" : ""}`}
                          key={listing.listing_id}
                          onClick={() =>
                            setTenantFeedFilterDraft((current) => {
                              const nextIds = active
                                ? current.listing_ids.filter((id) => id !== listing.listing_id)
                                : [...current.listing_ids, listing.listing_id];
                              return {
                                ...current,
                                listing_ids: nextIds
                              };
                            })
                          }
                          type="button"
                        >
                          {listing.headline}
                        </button>
                      );
                    })}
                </div>
              </label>

              <label>
                <span>Minimum salary (used for ranking only)</span>
                <input
                  inputMode="numeric"
                  value={tenantFeedFilterDraft.min_salary_inr ?? ""}
                  onChange={(event) =>
                    setTenantFeedFilterDraft((current) => ({
                      ...current,
                      min_salary_inr: Number(event.target.value) || null
                    }))
                  }
                />
              </label>

              <label>
                <span>Maximum salary (used for ranking only)</span>
                <input
                  inputMode="numeric"
                  value={tenantFeedFilterDraft.max_salary_inr ?? ""}
                  onChange={(event) =>
                    setTenantFeedFilterDraft((current) => ({
                      ...current,
                      max_salary_inr: Number(event.target.value) || null
                    }))
                  }
                />
              </label>

              <label>
                <span>Minimum residents</span>
                <input
                  inputMode="numeric"
                  value={tenantFeedFilterDraft.min_residents ?? ""}
                  onChange={(event) =>
                    setTenantFeedFilterDraft((current) => ({
                      ...current,
                      min_residents: Number(event.target.value) || null
                    }))
                  }
                />
              </label>

              <label>
                <span>Maximum residents</span>
                <input
                  inputMode="numeric"
                  value={tenantFeedFilterDraft.max_residents ?? ""}
                  onChange={(event) =>
                    setTenantFeedFilterDraft((current) => ({
                      ...current,
                      max_residents: Number(event.target.value) || null
                    }))
                  }
                />
              </label>

              <label>
                <span>Max distance from listing (km)</span>
                <input
                  inputMode="numeric"
                  value={tenantFeedFilterDraft.max_distance_km ?? ""}
                  onChange={(event) =>
                    setTenantFeedFilterDraft((current) => ({
                      ...current,
                      max_distance_km: Number(event.target.value) || null
                    }))
                  }
                />
              </label>
            </div>

            <div className="ultra-feed-chip-row">
              {EMPLOYMENT_FILTER_OPTIONS.map((employmentType) => {
                const active = tenantFeedFilterDraft.employment_types.includes(employmentType);
                return (
                  <button
                    className={`ultra-feed-chip-button ${active ? "is-active" : ""}`}
                    key={employmentType}
                    onClick={() =>
                      setTenantFeedFilterDraft((current) => ({
                        ...current,
                        employment_types: active
                          ? current.employment_types.filter((item) => item !== employmentType)
                          : [...current.employment_types, employmentType]
                      }))
                    }
                    type="button"
                  >
                    {employmentType}
                  </button>
                );
              })}
            </div>

            <footer>
              <button className="ultra-feed-secondary-button" onClick={() => setFilterOpen(false)} type="button">
                Cancel
              </button>
              <button
                className="ultra-feed-primary-button"
                onClick={() => void applyTenantFiltersAndRefresh()}
                type="button"
              >
                Apply filters
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
