import type {
  AccountDashboardResponse,
  ActiveSubscriptionResponse,
  AmenityResponse,
  AuthSessionResponse,
  ConversationPreviewResponse,
  FeedCardMedia,
  FeedMediaLoadMoreResponse,
  FeedResponse,
  FeedTokenRefreshResponse,
  GeoFeatureResponse,
  LikesOverviewResponse,
  ListingCreate,
  ListingEditorResponse,
  ManagedListingCardResponse,
  MatchActionResponse,
  MediaUploadResponse,
  MatchThreadResponse,
  PlanResponse,
  PropertyCreate,
  PublicListingCardResponse,
  PublicListingDetailResponse,
  RoleType,
  TenantFeedResponse,
  TenantSearchPreferenceUpsert,
  UserResponse
} from "@/lib/types";

export interface StoredSession {
  deviceId: string;
  user?: UserResponse | null;
  sessionExpiresAt?: string;
}

const CLIENT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const SERVER_API_BASE = process.env.API_SERVER_URL ?? CLIENT_API_BASE;

function resolveBase(serverOverride?: boolean): string {
  if (serverOverride ?? typeof window === "undefined") {
    return SERVER_API_BASE;
  }
  return CLIENT_API_BASE;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: {
    session?: StoredSession | null;
    server?: boolean;
  } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (!isFormData && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.session) {
    headers.set("X-Device-Id", options.session.deviceId);
    headers.set("X-Client-Platform", "web");
  }

  const response = await fetch(`${resolveBase(options.server)}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as { detail?: string };
      throw new Error(data.detail ?? fallback);
    } catch (error) {
      if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
        throw error;
      }
      throw new Error(fallback);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function requestOtp(phoneNumber: string, deviceId: string) {
  return apiFetch<{ ok: boolean; dev_otp?: string | null }>("/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({
      phone_number: phoneNumber,
      device_id: deviceId
    })
  });
}

export async function verifyOtp(
  input: {
    phoneNumber: string;
    otp: string;
    deviceId: string;
  }
) {
  return apiFetch<AuthSessionResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({
      phone_number: input.phoneNumber,
      otp: input.otp,
      device_id: input.deviceId
    })
  });
}

export async function completeSignup(
  input: {
    onboardingToken: string;
    deviceId: string;
    fullName: string;
    email?: string;
    defaultRole?: RoleType;
  }
) {
  return apiFetch<AuthSessionResponse>("/auth/complete-signup", {
    method: "POST",
    body: JSON.stringify({
      onboarding_token: input.onboardingToken,
      device_id: input.deviceId,
      full_name: input.fullName,
      email: input.email,
      default_role: input.defaultRole ?? "TENANT"
    })
  });
}

export async function logout(session: StoredSession) {
  return apiFetch<{ ok: boolean }>(
    "/auth/logout",
    { method: "POST" },
    { session }
  );
}

export async function getDashboard(session: StoredSession) {
  return apiFetch<AccountDashboardResponse>("/accounts/me/dashboard", {}, { session });
}

export async function updateMe(
  session: StoredSession,
  payload: {
    full_name?: string;
    email?: string | null;
    default_role?: RoleType;
    avatar_media_asset_id?: string | null;
  }
) {
  return apiFetch<UserResponse>(
    "/accounts/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function upsertTenantProfile(
  session: StoredSession,
  payload: Record<string, unknown>
) {
  return apiFetch<{ ok: boolean }>(
    "/accounts/profiles/tenant",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function upsertOwnerProfile(
  session: StoredSession,
  payload: Record<string, unknown>
) {
  return apiFetch<{ ok: boolean }>(
    "/accounts/profiles/owner",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function upsertBrokerProfile(
  session: StoredSession,
  payload: Record<string, unknown>
) {
  return apiFetch<{ ok: boolean }>(
    "/accounts/profiles/broker",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function deleteTenantProfile(session: StoredSession) {
  return apiFetch<{ ok: boolean }>(
    "/accounts/profiles/tenant",
    {
      method: "DELETE"
    },
    { session }
  );
}

export async function requestAccountDeleteOtp(session: StoredSession) {
  return apiFetch<{ ok: boolean; dev_otp?: string | null }>(
    "/accounts/me/delete/request-otp",
    {
      method: "POST"
    },
    { session }
  );
}

export async function confirmAccountDelete(session: StoredSession, otp: string) {
  return apiFetch<{ ok: boolean }>(
    "/accounts/me/delete/confirm",
    {
      method: "POST",
      body: JSON.stringify({ otp })
    },
    { session }
  );
}

export async function listPlans() {
  return apiFetch<PlanResponse[]>("/accounts/plans");
}

export async function getCurrentSubscription(session: StoredSession) {
  return apiFetch<ActiveSubscriptionResponse>("/accounts/subscriptions/current", {}, { session });
}

export async function createSubscription(
  session: StoredSession,
  userId: string,
  planCode: "FREE" | "PREMIUM"
) {
  return apiFetch<ActiveSubscriptionResponse>(
    "/accounts/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        plan_code: planCode,
        auto_renew: false
      })
    },
    { session }
  );
}

export async function getAmenities(session: StoredSession) {
  return apiFetch<AmenityResponse[]>("/listings/amenities", {}, { session });
}

export async function listMyListings(session: StoredSession) {
  return apiFetch<ManagedListingCardResponse[]>("/listings/mine", {}, { session });
}

export async function getListingEditor(session: StoredSession, listingId: string) {
  return apiFetch<ListingEditorResponse>(`/listings/${listingId}/editor`, {}, { session });
}

export async function createProperty(session: StoredSession, payload: PropertyCreate) {
  return apiFetch<{ id: string }>(
    "/listings/properties",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function updateProperty(
  session: StoredSession,
  propertyId: string,
  payload: PropertyCreate
) {
  return apiFetch<{ id: string }>(
    `/listings/properties/${propertyId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function createListing(session: StoredSession, payload: ListingCreate) {
  return apiFetch<{ id: string; property_id: string }>(
    "/listings/",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function updateListing(
  session: StoredSession,
  listingId: string,
  payload: ListingCreate
) {
  return apiFetch<{ id: string; property_id: string }>(
    `/listings/${listingId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function deleteProperty(session: StoredSession, propertyId: string) {
  return apiFetch<{ ok: boolean }>(
    `/listings/properties/${propertyId}`,
    {
      method: "DELETE"
    },
    { session }
  );
}

export async function deleteListing(session: StoredSession, listingId: string) {
  return apiFetch<{ ok: boolean }>(
    `/listings/${listingId}`,
    {
      method: "DELETE"
    },
    { session }
  );
}

export async function updatePropertyMedia(
  session: StoredSession,
  propertyId: string,
  mediaAssetId: string,
  payload: {
    caption?: string | null;
    room_category?: string | null;
    sort_order?: number;
    is_primary?: boolean;
    crop_meta?: Record<string, unknown>;
  }
) {
  return apiFetch<{ ok: boolean }>(
    `/listings/properties/${propertyId}/media/${mediaAssetId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function reorderPropertyMedia(
  session: StoredSession,
  propertyId: string,
  mediaAssetIds: string[]
) {
  return apiFetch<{ ok: boolean }>(
    `/listings/properties/${propertyId}/media/reorder`,
    {
      method: "POST",
      body: JSON.stringify({
        media_asset_ids: mediaAssetIds
      })
    },
    { session }
  );
}

export async function deletePropertyMedia(
  session: StoredSession,
  propertyId: string,
  mediaAssetId: string
) {
  return apiFetch<{ ok: boolean }>(
    `/listings/properties/${propertyId}/media/${mediaAssetId}`,
    {
      method: "DELETE"
    },
    { session }
  );
}

export async function createMediaAsset(
  session: StoredSession,
  payload: Record<string, unknown>
) {
  return apiFetch<{ id: string }>(
    "/listings/media/assets",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function uploadMedia(
  session: StoredSession,
  input: {
    file: File;
    targetType: "USER" | "PROPERTY" | "LISTING" | "MESSAGE";
    targetId: string;
    mediaType: "IMAGE" | "VIDEO" | "FLOOR_PLAN" | "DOCUMENT";
    sortOrder?: number;
    isPrimary?: boolean;
    caption?: string;
    roomCategory?: string;
    cropPreset?: string;
    captureOrientation?: string;
    cropMeta?: Record<string, unknown>;
  }
) {
  const form = new FormData();
  form.set("file", input.file);
  form.set("target_type", input.targetType);
  form.set("target_id", input.targetId);
  form.set("media_type", input.mediaType);
  form.set("sort_order", String(input.sortOrder ?? 0));
  form.set("is_primary", String(Boolean(input.isPrimary)));
  if (input.caption) {
    form.set("caption", input.caption);
  }
  if (input.roomCategory) {
    form.set("room_category", input.roomCategory);
  }
  if (input.cropPreset) {
    form.set("crop_preset", input.cropPreset);
  }
  if (input.captureOrientation) {
    form.set("capture_orientation", input.captureOrientation);
  }
  if (input.cropMeta) {
    form.set("crop_meta", JSON.stringify(input.cropMeta));
  }
  return apiFetch<MediaUploadResponse>(
    "/media/uploads",
    {
      method: "POST",
      body: form
    },
    { session }
  );
}

export async function getSearchPreferences(session: StoredSession, tenantProfileId: string) {
  return apiFetch<TenantSearchPreferenceUpsert>(
    `/feed/preferences/${tenantProfileId}`,
    {},
    { session }
  );
}

export async function upsertSearchPreferences(
  session: StoredSession,
  payload: TenantSearchPreferenceUpsert
) {
  return apiFetch<{ ok: boolean }>(
    "/feed/preferences",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function getListingFeed(
  session: StoredSession,
  input: {
    tenant_profile_id: string;
    offset: number;
    limit?: number;
    exclude_listing_ids?: string[];
    session_id?: string;
    client_platform?: string;
  }
) {
  return apiFetch<FeedResponse>(
    "/feed/listings",
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        limit: input.limit ?? 3,
        client_platform: input.client_platform ?? "web"
      })
    },
    { session }
  );
}

export async function getTenantFeed(
  session: StoredSession,
  input: {
    listing_id: string;
    offset: number;
    limit?: number;
    exclude_tenant_profile_ids?: string[];
    session_id?: string;
    client_platform?: string;
    min_salary_inr?: number | null;
    max_salary_inr?: number | null;
    employment_types?: string[];
    min_residents?: number | null;
    max_residents?: number | null;
    max_distance_km?: number | null;
  }
) {
  return apiFetch<TenantFeedResponse>(
    "/feed/tenants",
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        limit: input.limit ?? 3,
        client_platform: input.client_platform ?? "web"
      })
    },
    { session }
  );
}

export async function searchGeoLocations(
  session: StoredSession,
  input: {
    query: string;
    limit?: number;
    country_code?: string | null;
    proximity_latitude?: number | null;
    proximity_longitude?: number | null;
  }
) {
  return apiFetch<GeoFeatureResponse[]>(
    "/geo/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: input.query,
        limit: input.limit ?? 6,
        country_code: input.country_code ?? null,
        proximity_latitude: input.proximity_latitude ?? null,
        proximity_longitude: input.proximity_longitude ?? null
      })
    },
    { session }
  );
}

export async function reverseGeoLocation(
  session: StoredSession,
  input: {
    latitude: number;
    longitude: number;
  }
) {
  return apiFetch<GeoFeatureResponse>(
    "/geo/reverse",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    { session }
  );
}

export async function refreshListingFeedToken(
  session: StoredSession,
  tenantProfileId: string,
  windowId: string
) {
  return apiFetch<FeedTokenRefreshResponse>(
    `/feed/listings/refresh/${tenantProfileId}`,
    {
      method: "POST",
      body: JSON.stringify({
        window_id: windowId
      })
    },
    { session }
  );
}

export async function refreshTenantFeedToken(
  session: StoredSession,
  listingId: string,
  windowId: string
) {
  return apiFetch<FeedTokenRefreshResponse>(
    `/feed/tenants/refresh/${listingId}`,
    {
      method: "POST",
      body: JSON.stringify({
        window_id: windowId
      })
    },
    { session }
  );
}

export async function loadMoreListingMedia(
  session: StoredSession,
  input: {
    tenant_profile_id: string;
    listing_id: string;
    window_id: string;
  }
) {
  return apiFetch<FeedMediaLoadMoreResponse>(
    `/feed/listings/${input.tenant_profile_id}/${input.listing_id}/media/load-more`,
    {
      method: "POST",
      body: JSON.stringify({
        window_id: input.window_id
      })
    },
    { session }
  );
}

export async function getListingFullMedia(session: StoredSession, listingId: string) {
  return apiFetch<FeedCardMedia[]>(`/feed/listings/${listingId}/media/full`, {}, { session });
}

export async function swipeListing(
  session: StoredSession,
  payload: {
    tenant_profile_id: string;
    tenant_user_id: string;
    listing_id: string;
    action: "LIKE" | "PASS" | "SUPERLIKE";
    source_session_id: string;
  }
) {
  return apiFetch<{ ok: boolean; match?: { match_id: string } | null }>(
    "/interactions/swipes/listings",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function swipeTenant(
  session: StoredSession,
  payload: {
    listing_id: string;
    tenant_profile_id: string;
    acted_by_user_id: string;
    action: "LIKE" | "PASS" | "SUPERLIKE";
    source_session_id: string;
  }
) {
  return apiFetch<{ ok: boolean; match?: { match_id: string } | null }>(
    "/interactions/swipes/tenants",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function listConversations(session: StoredSession) {
  return apiFetch<ConversationPreviewResponse[]>("/interactions/conversations", {}, { session });
}

export async function getMatchThread(session: StoredSession, matchId: string) {
  return apiFetch<MatchThreadResponse>(`/interactions/matches/${matchId}/messages`, {}, { session });
}

export async function sendMessage(
  session: StoredSession,
  matchId: string,
  payload: {
    sender_user_id: string;
    text_body?: string | null;
    media_asset_id?: string | null;
    message_type?: "TEXT" | "IMAGE" | "VIDEO";
  }
) {
  return apiFetch<{ id: string }>(
    `/interactions/matches/${matchId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        sender_user_id: payload.sender_user_id,
        text_body: payload.text_body ?? null,
        media_asset_id: payload.media_asset_id ?? null,
        message_type: payload.message_type ?? "TEXT"
      })
    },
    { session }
  );
}

export async function unmatchCounterpart(session: StoredSession, matchId: string) {
  return apiFetch<MatchActionResponse>(
    `/interactions/matches/${matchId}/unmatch`,
    {
      method: "POST"
    },
    { session }
  );
}

export async function getLikes(session: StoredSession) {
  return apiFetch<LikesOverviewResponse>("/interactions/likes", {}, { session });
}

export async function shareMatchContact(
  session: StoredSession,
  matchId: string,
  payload: { note?: string }
) {
  return apiFetch<MatchActionResponse>(
    `/interactions/matches/${matchId}/share-contact`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function shareMatchAddress(
  session: StoredSession,
  matchId: string,
  payload: { note?: string }
) {
  return apiFetch<MatchActionResponse>(
    `/interactions/matches/${matchId}/share-address`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function approveMatchVisit(
  session: StoredSession,
  matchId: string,
  payload: {
    scheduled_start_at?: string | null;
    scheduled_end_at?: string | null;
    visit_mode?: string | null;
    meeting_point?: string | null;
    owner_notes?: string | null;
  }
) {
  return apiFetch<MatchActionResponse>(
    `/interactions/matches/${matchId}/approve-visit`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function blockMatchCounterpart(
  session: StoredSession,
  matchId: string,
  payload: { reason?: string }
) {
  return apiFetch<MatchActionResponse>(
    `/interactions/matches/${matchId}/block`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function reportMatchCounterpart(
  session: StoredSession,
  matchId: string,
  payload: { reason_code: string; description?: string }
) {
  return apiFetch<MatchActionResponse>(
    `/interactions/matches/${matchId}/report`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function undoListingSwipe(
  session: StoredSession,
  payload: {
    tenant_profile_id: string;
    tenant_user_id: string;
    listing_id: string;
  }
) {
  return apiFetch<{ ok: boolean }>(
    "/interactions/swipes/listings/undo",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function undoTenantSwipe(
  session: StoredSession,
  payload: {
    listing_id: string;
    tenant_profile_id: string;
    acted_by_user_id: string;
  }
) {
  return apiFetch<{ ok: boolean }>(
    "/interactions/swipes/tenants/undo",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { session }
  );
}

export async function listPublicListings(
  input: {
    limit?: number;
    offset?: number;
  } = {},
  options: { server?: boolean } = {}
) {
  const query = new URLSearchParams({
    limit: String(input.limit ?? 24),
    offset: String(input.offset ?? 0)
  });
  return apiFetch<PublicListingCardResponse[]>(`/listings/public?${query.toString()}`, {}, options);
}

export async function getPublicListing(
  listingId: string,
  options: { server?: boolean } = {}
) {
  return apiFetch<PublicListingDetailResponse>(`/listings/public/${listingId}`, {}, options);
}
