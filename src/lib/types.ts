export type RoleType = "TENANT" | "OWNER" | "BROKER" | "ADMIN" | "MODERATOR";
export type ListingStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "PAUSED"
  | "HIDDEN"
  | "RENTED"
  | "ARCHIVED"
  | "REJECTED";
export type SubscriptionPlanCode = "FREE" | "PREMIUM";
export type MatchStatus = "ACTIVE" | "BLOCKED" | "CLOSED" | "EXPIRED";
export type SwipeActionType = "LIKE" | "PASS" | "SUPERLIKE";
export type MediaType = "IMAGE" | "VIDEO" | "FLOOR_PLAN" | "DOCUMENT";
export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "SYSTEM" | "AGREEMENT" | "LISTING_SHARE";

export interface UserResponse {
  id: string;
  phone_e164: string;
  email?: string | null;
  full_name: string;
  default_role: RoleType;
  status: string;
}

export interface MediaPreviewResponse {
  media_asset_id: string;
  delivery_url: string;
  blurhash?: string | null;
  dominant_color?: string | null;
}

export interface TenantProfileSummaryResponse {
  id: string;
  user_id: string;
  bio?: string | null;
  employment_status?: string | null;
  occupation?: string | null;
  employer_name?: string | null;
  monthly_income_inr?: number | null;
  preferred_move_in_date?: string | null;
  preferred_stay_months?: number | null;
  max_rent_inr?: number | null;
  preferred_localities: string[];
  family_size?: number | null;
  has_pets: boolean;
  pet_details?: string | null;
  smoking_preference?: string | null;
  food_preference?: string | null;
  languages: string[];
  about_lifestyle?: string | null;
  profile_image_media_asset_id?: string | null;
  profile_image?: MediaPreviewResponse | null;
  commute_radius_km?: number | null;
  verified_badge_visible: boolean;
  completion_score: number;
}

export interface OwnerProfileSummaryResponse {
  id: string;
  user_id: string;
  company_name?: string | null;
  gstin?: string | null;
  about?: string | null;
  preferred_contact_mode?: string | null;
  response_time_minutes?: number | null;
  accepts_digital_agreements: boolean;
  avatar_media_asset_id?: string | null;
  avatar_image?: MediaPreviewResponse | null;
}

export interface BrokerProfileSummaryResponse {
  id: string;
  user_id: string;
  agency_name?: string | null;
  rera_registration_number?: string | null;
  years_experience?: number | null;
  brokerage_percentage_default?: number | null;
  serviceable_localities: string[];
  about?: string | null;
  avatar_media_asset_id?: string | null;
  avatar_image?: MediaPreviewResponse | null;
}

export interface ActiveSubscriptionResponse {
  subscription_id?: string | null;
  plan_id: string;
  plan_code: SubscriptionPlanCode;
  plan_name: string;
  status: string;
  price_inr: number;
  billing_period_months: number;
  expires_at?: string | null;
  feature_flags: Record<string, unknown>;
}

export interface AccountDashboardResponse {
  user: UserResponse;
  roles: RoleType[];
  tenant_profile?: TenantProfileSummaryResponse | null;
  owner_profile?: OwnerProfileSummaryResponse | null;
  broker_profile?: BrokerProfileSummaryResponse | null;
  active_subscription: ActiveSubscriptionResponse;
}

export interface PlanResponse {
  id: string;
  code: SubscriptionPlanCode;
  name: string;
  description?: string | null;
  price_inr: number;
  billing_period_months: number;
  daily_like_limit?: number | null;
  can_create_multiple_listings: boolean;
  can_rewind: boolean;
  can_direct_like_back: boolean;
  can_see_who_liked: boolean;
  priority_support: boolean;
}

export interface AmenityResponse {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  description?: string | null;
  is_searchable: boolean;
}

export interface ManagedListingCardResponse {
  listing_id: string;
  property_id: string;
  headline: string;
  title: string;
  listing_source_type: string;
  property_type: string;
  furnishing_type: string;
  status: ListingStatus;
  plan_code: SubscriptionPlanCode;
  monthly_rent_inr: number;
  security_deposit_inr: number;
  brokerage_percentage?: number | null;
  bhk: number;
  locality?: string | null;
  city: string;
  state: string;
  is_verified: boolean;
  visibility_mode: string;
  created_at: string;
  available_from?: string | null;
  updated_at: string;
  cover_image?: MediaPreviewResponse | null;
}

export interface TenantSearchPreferenceUpsert {
  tenant_profile_id: string;
  city?: string | null;
  state?: string | null;
  preferred_localities: string[];
  min_rent_inr?: number | null;
  max_rent_inr?: number | null;
  min_bhk?: number | null;
  max_bhk?: number | null;
  property_types: string[];
  furnishing_types: string[];
  min_area_sqft?: number | null;
  max_area_sqft?: number | null;
  move_in_from?: string | null;
  move_in_to?: string | null;
  min_lease_months?: number | null;
  max_brokerage_percentage?: number | null;
  max_security_deposit_inr?: number | null;
  parking_required: boolean;
  allows_pets?: boolean | null;
  food_preference?: string | null;
  smoking_preference?: string | null;
  only_verified_listings: boolean;
  only_owner_listings: boolean;
  commute_latitude?: number | null;
  commute_longitude?: number | null;
  commute_radius_km?: number | null;
  ranking_weights: Record<string, unknown>;
  amenity_ids: string[];
  extra_data: Record<string, unknown>;
}

export interface GeoFeatureResponse {
  mapbox_id?: string | null;
  name: string;
  full_address: string;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
}

export interface FeedCardMedia {
  media_asset_id: string;
  media_type: MediaType;
  is_primary: boolean;
  preload_order: number;
  delivery_url?: string | null;
  worker_url?: string | null;
  object_key?: string | null;
  mime_type?: string | null;
  blurhash?: string | null;
  dominant_color?: string | null;
  caption?: string | null;
  room_category?: string | null;
}

export interface FeedCard {
  listing_id: string;
  property_id: string;
  headline: string;
  monthly_rent_inr: number;
  security_deposit_inr: number;
  locality?: string | null;
  city: string;
  state: string;
  bhk: number;
  furnishing_type: string;
  match_score: number;
  budget_score: number;
  location_score: number;
  amenity_score: number;
  lifestyle_score: number;
  verification_score: number;
  freshness_score: number;
  premium_boost_score: number;
  image_count_total: number;
  preload_image_count: number;
  should_prefetch_full_when_active: boolean;
  media: FeedCardMedia[];
  reasons: string[];
}

export interface FeedResponse {
  cards: FeedCard[];
  next_offset: number;
  window_id: string;
  feed_token: string;
  feed_token_expires_at: string;
}

export interface FeedTokenRefreshResponse {
  window_id: string;
  feed_token: string;
  feed_token_expires_at: string;
}

export interface TenantFeedCard {
  tenant_profile_id: string;
  tenant_user_id: string;
  full_name: string;
  occupation?: string | null;
  employer_name?: string | null;
  preferred_move_in_date?: string | null;
  preferred_stay_months?: number | null;
  family_size?: number | null;
  has_pets: boolean;
  food_preference?: string | null;
  smoking_preference?: string | null;
  preferred_localities: string[];
  languages: string[];
  about_lifestyle?: string | null;
  completion_score: number;
  verified_badge_visible: boolean;
  match_score: number;
  budget_score: number;
  location_score: number;
  amenity_score: number;
  lifestyle_score: number;
  verification_score: number;
  freshness_score: number;
  premium_boost_score: number;
  preload_image_count: number;
  should_prefetch_full_when_active: boolean;
  media: FeedCardMedia[];
  reasons: string[];
}

export interface TenantFeedResponse {
  cards: TenantFeedCard[];
  next_offset: number;
  window_id: string;
  feed_token: string;
  feed_token_expires_at: string;
}

export interface FeedMediaLoadMoreResponse {
  listing_id: string;
  property_id: string;
  loaded_image_count: number;
  total_image_count: number;
  media: FeedCardMedia[];
  feed_token: string;
  feed_token_expires_at: string;
}

export interface PublicListingCardResponse {
  listing_id: string;
  slug: string;
  headline: string;
  locality?: string | null;
  city: string;
  state: string;
  images: MediaPreviewResponse[];
}

export interface PublicListingDetailResponse extends PublicListingCardResponse {
  sign_in_cta_label: string;
}

export interface ConversationPreviewResponse {
  conversation_id: string;
  match_id: string;
  listing_id: string;
  headline: string;
  locality?: string | null;
  city: string;
  counterpart_name: string;
  counterpart_role: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  cover_image?: MediaPreviewResponse | null;
}

export interface MatchResponse {
  match_id: string;
  listing_id: string;
  tenant_profile_id: string;
  status: MatchStatus;
  conversation_id?: string | null;
}

export interface ChatMessageResponse {
  id: string;
  sender_user_id: string;
  sender_name: string;
  is_mine: boolean;
  message_type: MessageType;
  text_body?: string | null;
  media_preview?: MediaPreviewResponse | null;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
}

export interface MatchThreadResponse {
  conversation_id: string;
  match: MatchResponse;
  listing: ManagedListingCardResponse;
  counterpart_name: string;
  counterpart_role: string;
  tenant_preview?: TenantPreviewResponse | null;
  messages: ChatMessageResponse[];
  shared_listing_address?: string | null;
  shared_contact_name?: string | null;
  shared_contact_phone?: string | null;
  shared_contact_email?: string | null;
  visit_status?: string | null;
  can_share_listing_address: boolean;
  can_share_contact: boolean;
  can_approve_visit: boolean;
}

export interface TenantPreviewResponse {
  tenant_profile_id: string;
  tenant_user_id: string;
  full_name: string;
  occupation?: string | null;
  employer_name?: string | null;
  preferred_move_in_date?: string | null;
  preferred_stay_months?: number | null;
  family_size?: number | null;
  has_pets: boolean;
  food_preference?: string | null;
  smoking_preference?: string | null;
  preferred_localities: string[];
  languages: string[];
  about_lifestyle?: string | null;
  completion_score: number;
  verified_badge_visible: boolean;
  profile_image?: MediaPreviewResponse | null;
}

export interface LikeListItemResponse {
  like_id: string;
  listing_id: string;
  tenant_profile_id: string;
  preview_kind: "LISTING" | "TENANT";
  direction: string;
  action: SwipeActionType;
  liked_at: string;
  match_id?: string | null;
  conversation_id?: string | null;
  headline: string;
  locality?: string | null;
  city: string;
  counterpart_name: string;
  counterpart_role: string;
  cover_image?: MediaPreviewResponse | null;
  tenant_preview?: TenantPreviewResponse | null;
}

export interface LikesOverviewResponse {
  sent: LikeListItemResponse[];
  received: LikeListItemResponse[];
}

export interface MatchActionResponse {
  ok: boolean;
  match_status?: MatchStatus | null;
  conversation_status?: string | null;
  visit_status?: string | null;
}

export interface EditorMediaResponse {
  id: string;
  target_type: string;
  target_id: string;
  media_type: MediaType;
  sort_order: number;
  is_primary: boolean;
  caption?: string | null;
  room_category?: string | null;
  capture_orientation?: string | null;
  crop_preset?: string | null;
  crop_meta?: Record<string, unknown>;
  blurhash?: string | null;
  dominant_color?: string | null;
  delivery_url?: string | null;
}

export interface AddressCreate {
  line1: string;
  line2?: string | null;
  building_name?: string | null;
  street?: string | null;
  locality?: string | null;
  sublocality?: string | null;
  landmark?: string | null;
  city: string;
  district?: string | null;
  state: string;
  postal_code: string;
  country: string;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
}

export interface AmenitySelection {
  amenity_id: string;
  value_text?: string | null;
  is_highlighted: boolean;
}

export interface ListingPreferencePayload {
  min_age?: number | null;
  max_age?: number | null;
  min_income_inr?: number | null;
  preferred_languages: string[];
  preferred_employment_types: string[];
  required_documents: string[];
  allows_flatmates: boolean;
  max_family_members?: number | null;
  parking_required: boolean;
  commute_landmarks: Array<Record<string, unknown>>;
  non_negotiables: string[];
  extra_data: Record<string, unknown>;
}

export interface PropertyCreate {
  owner_user_id?: string | null;
  broker_user_id?: string | null;
  created_by_user_id: string;
  address: AddressCreate;
  property_type: string;
  listing_source_type: string;
  title: string;
  description?: string | null;
  bhk: number;
  bedrooms_count: number;
  bathrooms_count: number;
  balconies_count?: number | null;
  floor_number?: number | null;
  total_floors?: number | null;
  super_builtup_area_sqft?: number | null;
  carpet_area_sqft?: number | null;
  plot_area_sqft?: number | null;
  facing?: string | null;
  furnishing_type: string;
  parking_type?: string | null;
  parking_slots?: number | null;
  property_age_years?: number | null;
  available_from?: string | null;
  is_gated_community: boolean;
  has_lift: boolean;
  power_backup_type?: string | null;
  water_supply_type?: string | null;
  internet_ready: boolean;
  has_air_conditioning: boolean;
  has_washing_machine: boolean;
  has_refrigerator: boolean;
  has_geyser: boolean;
  has_cupboards: boolean;
  has_modular_kitchen: boolean;
  brokerage_percentage?: number | null;
  amenity_items: AmenitySelection[];
  extra_data: Record<string, unknown>;
}

export interface ListingCreate {
  property_id: string;
  owner_user_id?: string | null;
  broker_user_id?: string | null;
  created_by_user_id: string;
  headline: string;
  description?: string | null;
  monthly_rent_inr: number;
  maintenance_inr: number;
  security_deposit_inr: number;
  brokerage_percentage?: number | null;
  brokerage_amount_inr?: number | null;
  is_brokerage_negotiable: boolean;
  additional_charges: Array<Record<string, unknown>>;
  additional_charge_notes?: string | null;
  min_lease_months?: number | null;
  max_lease_months?: number | null;
  lock_in_months?: number | null;
  notice_period_days?: number | null;
  available_from?: string | null;
  available_to?: string | null;
  occupancy_limit?: number | null;
  current_occupancy?: number | null;
  preferred_tenant_gender?: string | null;
  preferred_tenant_types: string[];
  preferred_occupations: string[];
  food_preference?: string | null;
  smoking_policy?: string | null;
  is_rent_negotiable: boolean;
  is_verified: boolean;
  is_promoted: boolean;
  is_instant_chat_enabled: boolean;
  status: ListingStatus;
  media_asset_ids: string[];
  preferences?: ListingPreferencePayload | null;
  extra_data: Record<string, unknown>;
}

export interface ListingEditorResponse {
  property: PropertyCreate;
  listing: ListingCreate;
  media_assets: EditorMediaResponse[];
}

export interface AuthSessionResponse {
  device_id: string;
  session_expires_at?: string | null;
  user?: UserResponse | null;
  is_new_user: boolean;
  onboarding_required?: boolean;
  onboarding_token?: string | null;
  dev_otp?: string | null;
}

export interface MediaUploadResponse {
  media_asset_id: string;
  object_key: string;
  target_type: string;
  target_id: string;
  media_type: MediaType;
  mime_type: string;
  size_bytes: number;
  delivery_url: string;
}
