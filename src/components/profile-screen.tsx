"use client";

import Link from "next/link";
import {
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AppShell } from "@/components/app-shell";
import { AuthRequired } from "@/components/auth-required";
import {
  MapboxLocationPicker,
  type LocationValue,
} from "@/components/mapbox-location-picker";
import { useAuth } from "@/components/providers/auth-provider";
import { TenantFeedCard, type TenantFeedCardSection } from "@/components/tenant-feed-card";
import {
  deleteTenantProfile,
  getDashboard,
  getSearchPreferences,
  updateMe,
  uploadMedia,
  upsertSearchPreferences,
  upsertTenantProfile,
} from "@/lib/api";
import type { TenantSearchPreferenceUpsert } from "@/lib/types";
import { useSecureMediaCache } from "@/lib/use-secure-media-cache";
import { splitCsv } from "@/lib/utils";

type ProfileFlowStep = 1 | 2 | 3;

type ProfileImageEditorState = {
  open: boolean;
  file: File | null;
  previewUrl: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  busy: boolean;
};

const PROPERTY_TYPE_OPTIONS = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "BUILDER_FLOOR", label: "Builder floor" },
  { value: "HOUSE", label: "Independent house" },
  { value: "VILLA", label: "Villa" },
  { value: "ROOM", label: "Room / Roommate" },
  { value: "STUDIO", label: "Studio" },
  { value: "PG_CO_LIVING", label: "PG / Co-living" },
];

const FURNISHING_OPTIONS = [
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI_FURNISHED", label: "Semi furnished" },
  { value: "FULLY_FURNISHED", label: "Fully furnished" },
];

const EMPLOYMENT_STATUS_OPTIONS = [
  "Full time",
  "Self employed",
  "Student",
  "Contract",
  "Business owner",
  "Remote worker",
];

const FOOD_PREFERENCE_OPTIONS = [
  { value: "ANY", label: "Any" },
  { value: "VEG_ONLY", label: "Veg only" },
  { value: "NON_VEG_ALLOWED", label: "Non-veg allowed" },
  { value: "EGGETARIAN_ONLY", label: "Eggetarian only" },
];

const SMOKING_PREFERENCE_OPTIONS = [
  { value: "NOT_ALLOWED", label: "No smoking" },
  { value: "OUTSIDE_ONLY", label: "Outside only" },
  { value: "NEGOTIABLE", label: "Negotiable" },
  { value: "ALLOWED", label: "Allowed" },
];

function HeaderIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function emptyLocationValue(): LocationValue {
  return {
    latitude: null,
    longitude: null,
    line1: "",
    locality: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    fullAddress: "",
  };
}

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
    extra_data: {},
  };
}

function defaultProfileImageEditor(previewUrl: string | null): ProfileImageEditorState {
  return {
    open: false,
    file: null,
    previewUrl,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    busy: false,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatLabel(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().replaceAll("_", " ");
  if (!normalized) {
    return fallback;
  }
  return normalized
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((chunk) => `${chunk.slice(0, 1).toUpperCase()}${chunk.slice(1)}`)
    .join(" ");
}

function buildLocationSummary(location: LocationValue) {
  return [location.locality, location.city, location.state]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(", ");
}

export function ProfileScreen() {
  const { dashboard, loading, refreshDashboard, session } = useAuth();
  const { queuePrefetch, resolveUrl } = useSecureMediaCache({ concurrency: 2 });

  const [fullName, setFullName] = useState("");
  const [tenantBio, setTenantBio] = useState("");
  const [tenantOccupation, setTenantOccupation] = useState("");
  const [tenantEmployer, setTenantEmployer] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [familySize, setFamilySize] = useState(1);
  const [preferredStayMonths, setPreferredStayMonths] = useState(12);
  const [preferredMoveInDate, setPreferredMoveInDate] = useState("");
  const [hasPets, setHasPets] = useState(false);
  const [foodPreference, setFoodPreference] = useState("ANY");
  const [smokingPreference, setSmokingPreference] = useState("NOT_ALLOWED");
  const [languagesText, setLanguagesText] = useState("");
  const [aboutLifestyle, setAboutLifestyle] = useState("");
  const [preferredLocalitiesText, setPreferredLocalitiesText] = useState("");
  const [searchDraft, setSearchDraft] = useState<TenantSearchPreferenceUpsert | null>(null);
  const [tenantSearchLocation, setTenantSearchLocation] = useState<LocationValue>(emptyLocationValue);
  const [tenantSearchRadiusKm, setTenantSearchRadiusKm] = useState(20);
  const [profileImageAssetId, setProfileImageAssetId] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [imageEditor, setImageEditor] = useState<ProfileImageEditorState>(
    defaultProfileImageEditor(null)
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ProfileFlowStep>(1);
  const [editMode, setEditMode] = useState(true);
  const [previewMobileDetailsExpanded, setPreviewMobileDetailsExpanded] = useState(false);

  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const cropPointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const cropTouchStateRef = useRef<
    | {
        mode: "drag";
        startX: number;
        startY: number;
        startOffsetX: number;
        startOffsetY: number;
      }
    | {
        mode: "pinch";
        startDistance: number;
        startZoom: number;
      }
    | null
  >(null);

  const tenantProfile = dashboard?.tenant_profile ?? null;
  const dashboardUserId = dashboard?.user.id ?? null;
  const hasTenantRole = useMemo(
    () => Boolean(dashboard?.roles.includes("TENANT") || dashboard?.user.default_role === "TENANT"),
    [dashboard?.roles, dashboard?.user.default_role]
  );
  const canPreviewProfile = Boolean(profileImageAssetId && hasTenantRole);
  const locationSummary = buildLocationSummary(tenantSearchLocation);
  const searchBudget = searchDraft?.max_rent_inr ?? tenantProfile?.max_rent_inr ?? null;
  const persistedProfileAsset =
    profileImageAssetId && profileImageUrl
      ? {
          media_asset_id: profileImageAssetId,
          delivery_url: profileImageUrl,
        }
      : null;
  const previewImageSrc =
    resolveUrl(
      persistedProfileAsset,
      profileImageUrl ?? "https://placehold.co/900x1200/0d1117/e6ecf3?text=Profile"
    ) ?? "https://placehold.co/900x1200/0d1117/e6ecf3?text=Profile";
  const previewTitle = fullName.trim() || dashboard?.user.full_name || "Tenant profile";
  const previewSubtitle = [
    tenantOccupation.trim() || "Tenant",
    tenantEmployer.trim() || employmentStatus.trim() || "Browsing for a home",
  ]
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .join(" · ");

  const previewSections = useMemo<TenantFeedCardSection[]>(
    () => [
      {
        title: "Preferences",
        items: [
          `Preferred localities: ${splitCsv(preferredLocalitiesText).join(", ") || locationSummary || "Flexible"}`,
          `Property types: ${
            searchDraft?.property_types.length
              ? searchDraft.property_types.map((value) => formatLabel(value, value)).join(", ")
              : "Open"
          }`,
          `Furnishing: ${
            searchDraft?.furnishing_types.length
              ? searchDraft.furnishing_types.map((value) => formatLabel(value, value)).join(", ")
              : "Open"
          }`,
          `Languages: ${splitCsv(languagesText).join(", ") || "Not specified"}`,
        ],
      },
      {
        title: "What listers will see",
        items: [
          "Exact address stays private and only the search locality is used for matching.",
          "Salary is used internally for recommendations and is not shown in tenant browsing cards.",
          "Contact details stay hidden until match and share actions happen inside chat.",
        ],
      },
      ...(aboutLifestyle.trim()
        ? [
            {
              title: "About lifestyle",
              body: aboutLifestyle.trim(),
            },
          ]
        : []),
    ],
    [aboutLifestyle, languagesText, locationSummary, preferredLocalitiesText, searchDraft]
  );

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    setFullName(dashboard.user.full_name);
    setTenantBio(tenantProfile?.bio ?? "");
    setTenantOccupation(tenantProfile?.occupation ?? "");
    setTenantEmployer(tenantProfile?.employer_name ?? "");
    setEmploymentStatus(tenantProfile?.employment_status ?? "");
    setFamilySize(Math.max(1, tenantProfile?.family_size ?? 1));
    setPreferredStayMonths(Math.max(1, tenantProfile?.preferred_stay_months ?? 12));
    setPreferredMoveInDate(tenantProfile?.preferred_move_in_date ?? "");
    setHasPets(Boolean(tenantProfile?.has_pets));
    setFoodPreference(tenantProfile?.food_preference ?? "ANY");
    setSmokingPreference(tenantProfile?.smoking_preference ?? "NOT_ALLOWED");
    setLanguagesText((tenantProfile?.languages ?? []).join(", "));
    setAboutLifestyle(tenantProfile?.about_lifestyle ?? "");
    setPreferredLocalitiesText((tenantProfile?.preferred_localities ?? []).join(", "));
    setProfileImageAssetId(tenantProfile?.profile_image_media_asset_id ?? null);
    setProfileImageUrl(tenantProfile?.profile_image?.delivery_url ?? null);
    setImageEditor(defaultProfileImageEditor(tenantProfile?.profile_image?.delivery_url ?? null));
    setEditMode(!(tenantProfile?.profile_image_media_asset_id && hasTenantRole));
    setCurrentStep(1);
    setPreviewMobileDetailsExpanded(false);
  }, [dashboard, hasTenantRole, tenantProfile]);

  useEffect(() => {
    if (!session || !hasTenantRole) {
      setSearchDraft(dashboardUserId ? defaultPreferences(dashboardUserId) : null);
      setTenantSearchLocation(emptyLocationValue());
      return;
    }
    if (!tenantProfile?.id) {
      setSearchDraft(dashboardUserId ? defaultPreferences(dashboardUserId) : null);
      setTenantSearchLocation(emptyLocationValue());
      return;
    }

    getSearchPreferences(session, tenantProfile.id)
      .then((preferences) => {
        setSearchDraft(preferences);
        setTenantSearchRadiusKm(preferences.commute_radius_km ?? tenantProfile.commute_radius_km ?? 20);
        setTenantSearchLocation({
          latitude: preferences.commute_latitude ?? null,
          longitude: preferences.commute_longitude ?? null,
          line1: "",
          locality: preferences.preferred_localities[0] ?? "",
          city: preferences.city ?? "",
          state: preferences.state ?? "",
          postalCode: "",
          country: "India",
          fullAddress: [preferences.preferred_localities[0], preferences.city, preferences.state]
            .filter((value) => (value ?? "").trim().length > 0)
            .join(", "),
        });
      })
      .catch((nextError) => {
        setError(
          nextError instanceof Error ? nextError.message : "Unable to load tenant preferences"
        );
      });
  }, [dashboardUserId, hasTenantRole, session, tenantProfile, tenantProfile?.id]);

  useEffect(() => {
    if (persistedProfileAsset?.delivery_url) {
      queuePrefetch(persistedProfileAsset, 260);
    }
  }, [persistedProfileAsset, queuePrefetch]);

  function updateSearchDraft(
    updater: (current: TenantSearchPreferenceUpsert) => TenantSearchPreferenceUpsert
  ) {
    setSearchDraft((current) =>
      updater(current ?? defaultPreferences(tenantProfile?.id ?? dashboardUserId ?? ""))
    );
  }

  function toggleMultiValue(
    currentValues: string[],
    nextValue: string,
    onChange: (next: string[]) => void
  ) {
    if (currentValues.includes(nextValue)) {
      onChange(currentValues.filter((value) => value !== nextValue));
      return;
    }
    onChange([...currentValues, nextValue]);
  }

  function openImageEditor() {
    setImageEditor({
      ...defaultProfileImageEditor(profileImageUrl),
      open: true,
      previewUrl: profileImageUrl,
    });
  }

  function closeImageEditor() {
    setImageEditor(defaultProfileImageEditor(profileImageUrl));
  }

  function handleImageFileSelect(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageEditor((current) => ({
        ...current,
        file,
        previewUrl: typeof reader.result === "string" ? reader.result : current.previewUrl,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      }));
    };
    reader.readAsDataURL(file);
  }

  function applyCropDragDelta(deltaX: number, deltaY: number, startOffsetX: number, startOffsetY: number) {
    const frameRect = cropFrameRef.current?.getBoundingClientRect();
    if (!frameRect) {
      return;
    }
    const horizontalStep = frameRect.width > 0 ? (deltaX / frameRect.width) * 100 : 0;
    const verticalStep = frameRect.height > 0 ? (deltaY / frameRect.height) * 100 : 0;
    setImageEditor((current) => ({
      ...current,
      offsetX: clampNumber(startOffsetX + horizontalStep, -40, 40),
      offsetY: clampNumber(startOffsetY + verticalStep, -40, 40),
    }));
  }

  function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!imageEditor.previewUrl || event.pointerType === "touch") {
      return;
    }
    event.preventDefault();
    cropFrameRef.current?.setPointerCapture(event.pointerId);
    cropPointerStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: imageEditor.offsetX,
      startOffsetY: imageEditor.offsetY,
    };
  }

  function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = cropPointerStateRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    applyCropDragDelta(
      event.clientX - state.startX,
      event.clientY - state.startY,
      state.startOffsetX,
      state.startOffsetY
    );
  }

  function handleCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cropPointerStateRef.current || cropPointerStateRef.current.pointerId !== event.pointerId) {
      return;
    }
    cropFrameRef.current?.releasePointerCapture(event.pointerId);
    cropPointerStateRef.current = null;
  }

  function touchDistance(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) {
      return 0;
    }
    const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
    return Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY
    );
  }

  function handleCropTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!imageEditor.previewUrl) {
      return;
    }
    if (event.touches.length >= 2) {
      cropTouchStateRef.current = {
        mode: "pinch",
        startDistance: Math.max(touchDistance(event), 1),
        startZoom: imageEditor.zoom,
      };
      return;
    }
    if (event.touches.length === 1) {
      cropTouchStateRef.current = {
        mode: "drag",
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startOffsetX: imageEditor.offsetX,
        startOffsetY: imageEditor.offsetY,
      };
    }
  }

  function handleCropTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const state = cropTouchStateRef.current;
    if (!state) {
      return;
    }
    if (state.mode === "pinch" && event.touches.length >= 2) {
      event.preventDefault();
      const nextDistance = Math.max(touchDistance(event), 1);
      const scale = nextDistance / state.startDistance;
      const nextZoom = clampNumber(state.startZoom * scale, 1, 2.4);
      setImageEditor((current) => ({
        ...current,
        zoom: Number(nextZoom.toFixed(2)),
      }));
      return;
    }
    if (state.mode === "drag" && event.touches.length === 1) {
      event.preventDefault();
      applyCropDragDelta(
        event.touches[0].clientX - state.startX,
        event.touches[0].clientY - state.startY,
        state.startOffsetX,
        state.startOffsetY
      );
    }
  }

  function handleCropTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2) {
      cropTouchStateRef.current = {
        mode: "pinch",
        startDistance: Math.max(touchDistance(event), 1),
        startZoom: imageEditor.zoom,
      };
      return;
    }
    if (event.touches.length === 1) {
      cropTouchStateRef.current = {
        mode: "drag",
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startOffsetX: imageEditor.offsetX,
        startOffsetY: imageEditor.offsetY,
      };
      return;
    }
    cropTouchStateRef.current = null;
  }

  function handleCropWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!imageEditor.previewUrl) {
      return;
    }
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.07 : -0.07;
    setImageEditor((current) => ({
      ...current,
      zoom: Number(clampNumber(current.zoom + step, 1, 2.4).toFixed(2)),
    }));
  }

  function resetCropFrame() {
    setImageEditor((current) => ({
      ...current,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }));
  }

  async function handleSaveProfileImage() {
    if (!session || !dashboardUserId || !imageEditor.file) {
      setError("Select a profile image before saving.");
      return;
    }
    setError(null);
    setStatus("Uploading profile image...");
    setImageEditor((current) => ({ ...current, busy: true }));
    try {
      const asset = await uploadMedia(session, {
        file: imageEditor.file,
        targetType: "USER",
        targetId: dashboardUserId,
        mediaType: "IMAGE",
        sortOrder: 1,
        isPrimary: true,
        cropPreset: "PORTRAIT_3_4",
        captureOrientation: "PORTRAIT",
        cropMeta: {
          frame: "3:4",
          zoom: Number(imageEditor.zoom.toFixed(2)),
          offset_x: Number(imageEditor.offsetX.toFixed(2)),
          offset_y: Number(imageEditor.offsetY.toFixed(2)),
        },
      });
      await updateMe(session, { avatar_media_asset_id: asset.media_asset_id });
      setProfileImageAssetId(asset.media_asset_id);
      setProfileImageUrl(asset.delivery_url ?? null);
      setImageEditor(defaultProfileImageEditor(asset.delivery_url ?? null));
      setStatus("Profile image saved. Finish the details to preview your tenant card.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save profile image");
    } finally {
      setImageEditor((current) => ({ ...current, busy: false }));
    }
  }

  async function handleSaveAndPreview() {
    if (!session || !dashboardUserId) {
      return;
    }
    if (!profileImageAssetId) {
      setError("Upload exactly one clear face photo before previewing your profile.");
      setCurrentStep(3);
      return;
    }
    setError(null);
    setStatus("Saving tenant profile...");

    try {
      await updateMe(session, {
        full_name: fullName.trim() || dashboard?.user.full_name || "",
        avatar_media_asset_id: profileImageAssetId,
      });

      await upsertTenantProfile(session, {
        user_id: dashboardUserId,
        bio: tenantBio || null,
        employment_status: employmentStatus || null,
        occupation: tenantOccupation || null,
        employer_name: tenantEmployer || null,
        preferred_move_in_date: preferredMoveInDate || null,
        preferred_stay_months: preferredStayMonths || null,
        max_rent_inr: searchDraft?.max_rent_inr ?? null,
        preferred_localities: splitCsv(preferredLocalitiesText),
        family_size: familySize || null,
        has_pets: hasPets,
        smoking_preference: smokingPreference || null,
        food_preference: foodPreference || null,
        languages: splitCsv(languagesText),
        about_lifestyle: aboutLifestyle || null,
        profile_image_media_asset_id: profileImageAssetId,
        commute_radius_km: tenantSearchRadiusKm,
      });

      const refreshedDashboard = await getDashboard(session);
      const refreshedTenantProfileId = refreshedDashboard.tenant_profile?.id;
      if (refreshedTenantProfileId) {
        const localityCandidates = [
          ...splitCsv(preferredLocalitiesText),
          ...(tenantSearchLocation.locality.trim() ? [tenantSearchLocation.locality.trim()] : []),
        ];
        const uniqueLocalities = Array.from(new Set(localityCandidates)).filter(Boolean);
        await upsertSearchPreferences(session, {
          ...(searchDraft ?? defaultPreferences(refreshedTenantProfileId)),
          tenant_profile_id: refreshedTenantProfileId,
          city: tenantSearchLocation.city || searchDraft?.city || null,
          state: tenantSearchLocation.state || searchDraft?.state || null,
          preferred_localities: uniqueLocalities,
          commute_latitude: tenantSearchLocation.latitude ?? null,
          commute_longitude: tenantSearchLocation.longitude ?? null,
          commute_radius_km: tenantSearchRadiusKm,
          max_rent_inr: searchDraft?.max_rent_inr ?? null,
        });
      }

      await refreshDashboard();
      setEditMode(false);
      setCurrentStep(1);
      setPreviewMobileDetailsExpanded(false);
      setStatus("Tenant profile updated. Showing owner-side preview.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save tenant profile");
    }
  }

  async function handleDeleteTenantProfile() {
    if (!session) {
      return;
    }
    setError(null);
    setStatus("Deleting tenant profile...");
    try {
      await deleteTenantProfile(session);
      setProfileImageAssetId(null);
      setProfileImageUrl(null);
      setEditMode(true);
      setCurrentStep(1);
      await refreshDashboard();
      setStatus("Tenant profile deleted. Add a new portrait image to browse properties again.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to delete tenant profile"
      );
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Profile"
        eyebrow="Loading"
        description="Loading your tenant identity, preferences, and secure media state."
        showHero={false}
      >
        <div className="empty-panel">Loading profile...</div>
      </AppShell>
    );
  }

  if (!session || !dashboard) {
    return (
      <div className="page-shell" style={{ padding: "32px 0" }}>
        <AuthRequired
          title="Your profile lives behind account access"
          description="Sign in to build and preview the tenant profile that owners will browse."
        />
      </div>
    );
  }

  if (!hasTenantRole) {
    return (
      <AppShell
        title="Profile"
        eyebrow="Tenant preview"
        description="This page now manages the tenant profile flow used for browsing properties."
        showHero={false}
      >
        <section className="surface">
          <div className="empty-panel">
            This account is currently a property-lister persona. Tenant browsing profile setup is only
            available on tenant accounts.
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Profile"
      eyebrow="Tenant profile"
      description="Build the exact tenant card that owners and brokers will see while browsing for renters."
      showHero={false}
    >
      {status ? (
        <div className="surface">
          <div className="hint">{status}</div>
        </div>
      ) : null}
      {error ? (
        <div className="surface">
          <div className="hint" style={{ color: "#ffd3d8" }}>
            {error}
          </div>
        </div>
      ) : null}

      {canPreviewProfile && !editMode ? (
        <section className="property-editor property-editor-modern properties-preview-page">
          <div className="properties-preview-title-row">
            <div>
              <strong>{previewTitle}</strong>
              <p className="section-copy" style={{ marginTop: 8 }}>
                This is the same secure profile card property owners and brokers will browse in feed.
              </p>
            </div>
          </div>
          <div className="properties-preview-card-stage">
            <TenantFeedCard
              avatarAlt={previewTitle}
              avatarSrc={previewImageSrc}
              chips={[
                employmentStatus.trim() || tenantOccupation.trim() || "Tenant profile",
                `${familySize} ${familySize === 1 ? "resident" : "residents"}`,
                `Move-in ${preferredMoveInDate || "Flexible"}`,
                `Stay ${preferredStayMonths || "-"} months`,
                `Pets ${hasPets ? "Yes" : "No"}`,
              ]}
              className="properties-feed-preview-card"
              floatingActions={
                <>
                  <button
                    className="ultra-feed-action-button ultra-feed-action-pill"
                    onClick={() => {
                      setEditMode(true);
                      setCurrentStep(1);
                    }}
                    type="button"
                  >
                    <HeaderIcon path="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-9.2a1 1 0 1 0-2 0V19H5V5h8.7a1 1 0 1 0 0-2H4.5zm14.8.2a1 1 0 0 0-1.4 0l-6.7 6.7a1 1 0 0 0-.27.51l-.6 2.4a1 1 0 0 0 1.22 1.22l2.4-.6a1 1 0 0 0 .5-.27l6.7-6.7a1 1 0 0 0 0-1.4l-1.1-1.1z" />
                    <span>Edit details</span>
                  </button>
                  <Link
                    className="ultra-feed-action-button ultra-feed-action-pill ultra-feed-action-pill-primary"
                    href="/"
                  >
                    <HeaderIcon path="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-9.2a1 1 0 1 0-2 0V19H5V5h8.7a1 1 0 1 0 0-2H4.5zm14.8.2a1 1 0 0 0-1.4 0l-6.7 6.7a1 1 0 0 0-.27.51l-.6 2.4a1 1 0 0 0 1.22 1.22l2.4-.6a1 1 0 0 0 .5-.27l6.7-6.7a1 1 0 0 0 0-1.4l-1.1-1.1z" />
                    <span>View properties</span>
                  </Link>
                </>
              }
              headline={previewTitle}
              mobileDetailsExpanded={previewMobileDetailsExpanded}
              onMobileDetailsExpandedChange={setPreviewMobileDetailsExpanded}
              score={{ value: "Preview", label: "owner card" }}
              sections={previewSections}
              stats={[
                {
                  label: "Completion",
                  value: `${Math.round(tenantProfile?.completion_score ?? 100)}%`,
                },
                {
                  label: "Search radius",
                  value: `${tenantSearchRadiusKm} km`,
                },
                {
                  label: "Budget",
                  value: searchBudget ? `Rs ${searchBudget.toLocaleString("en-IN")}` : "Flexible",
                },
                {
                  label: "Listings",
                  value: searchDraft?.only_verified_listings ? "Verified only" : "All",
                },
              ]}
              subheadline={previewSubtitle}
            />
          </div>
        </section>
      ) : (
        <div className="field-stack">
          <section className="property-editor property-editor-modern">
            <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
              <div>
                <strong>{previewTitle || "Tenant profile"}</strong>
                <p className="section-copy" style={{ marginTop: 8 }}>
                  Complete the three steps to unlock browsing and owner-side preview.
                </p>
              </div>
              <div className="inline-stack">
                {canPreviewProfile ? (
                  <button className="soft-button" onClick={() => setEditMode(false)} type="button">
                    Back to preview
                  </button>
                ) : null}
                <Link className="ghost-button" href="/">
                  View properties
                </Link>
              </div>
            </div>
            <div className="properties-stepper">
              {[1, 2, 3].map((step) => (
                <button
                  className={`properties-step-pill ${currentStep === step ? "is-active" : ""}`}
                  key={`profile-step-${step}`}
                  onClick={() => setCurrentStep(step as ProfileFlowStep)}
                  type="button"
                >
                  {step === 1 ? "Your details" : step === 2 ? "Property preferences" : "Profile image"}
                </button>
              ))}
            </div>
          </section>

          {currentStep === 1 ? (
            <section className="property-editor property-editor-modern">
              <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                <div>
                  <strong>Step 1: Your details</strong>
                  <p className="section-copy" style={{ marginTop: 8 }}>
                    These details shape how your tenant card looks to property listers.
                  </p>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <div className="field-grid">
                  <div className="form-field">
                    <label>Full name</label>
                    <input
                      className="input"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Employment type</label>
                    <select
                      className="select"
                      value={employmentStatus}
                      onChange={(event) => setEmploymentStatus(event.target.value)}
                    >
                      <option value="">Select employment type</option>
                      {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-grid">
                  <div className="form-field">
                    <label>Occupation</label>
                    <input
                      className="input"
                      value={tenantOccupation}
                      onChange={(event) => setTenantOccupation(event.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Employer / Company</label>
                    <input
                      className="input"
                      value={tenantEmployer}
                      onChange={(event) => setTenantEmployer(event.target.value)}
                    />
                  </div>
                </div>

                <div className="field-grid">
                  <div className="form-field">
                    <label>Residents count</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      type="number"
                      min={1}
                      value={familySize}
                      onChange={(event) => setFamilySize(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>
                  <div className="form-field">
                    <label>Preferred stay (months)</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      type="number"
                      min={1}
                      value={preferredStayMonths}
                      onChange={(event) =>
                        setPreferredStayMonths(Math.max(1, Number(event.target.value) || 1))
                      }
                    />
                  </div>
                </div>

                <div className="field-grid">
                  <div className="form-field">
                    <label>Preferred move-in date</label>
                    <input
                      className="input"
                      type="date"
                      value={preferredMoveInDate}
                      onChange={(event) => setPreferredMoveInDate(event.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Languages</label>
                    <input
                      className="input"
                      placeholder="English, Hindi, Gujarati"
                      value={languagesText}
                      onChange={(event) => setLanguagesText(event.target.value)}
                    />
                  </div>
                </div>

                <div className="properties-toggle-grid">
                  {[
                    {
                      key: "pets",
                      label: hasPets ? "Pets: yes" : "Pets: no",
                      active: hasPets,
                      onClick: () => setHasPets((current) => !current),
                    },
                    {
                      key: "food",
                      label: `Food: ${formatLabel(foodPreference, "Any")}`,
                      active: true,
                      onClick: () => undefined,
                    },
                    {
                      key: "smoking",
                      label: `Smoking: ${formatLabel(smokingPreference, "No smoking")}`,
                      active: true,
                      onClick: () => undefined,
                    },
                  ].map((item) => (
                    <button
                      className={`properties-toggle-card ${item.active ? "is-active" : "is-inactive"}`}
                      key={item.key}
                      onClick={item.onClick}
                      type="button"
                    >
                      <span>Profile</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                </div>

                <div className="field-grid" style={{ marginTop: 14 }}>
                  <div className="form-field">
                    <label>Food preference</label>
                    <select
                      className="select"
                      value={foodPreference}
                      onChange={(event) => setFoodPreference(event.target.value)}
                    >
                      {FOOD_PREFERENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Smoking preference</label>
                    <select
                      className="select"
                      value={smokingPreference}
                      onChange={(event) => setSmokingPreference(event.target.value)}
                    >
                      {SMOKING_PREFERENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-field" style={{ marginTop: 14 }}>
                  <label>Bio</label>
                  <textarea
                    className="textarea"
                    value={tenantBio}
                    onChange={(event) => setTenantBio(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>About lifestyle</label>
                  <textarea
                    className="textarea"
                    value={aboutLifestyle}
                    onChange={(event) => setAboutLifestyle(event.target.value)}
                  />
                </div>

                <div className="action-row properties-step-actions">
                  <button className="primary-button" onClick={() => setCurrentStep(2)} type="button">
                    Continue to preferences
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section className="property-editor property-editor-modern">
              <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                <div>
                  <strong>Step 2: Property preferences</strong>
                  <p className="section-copy" style={{ marginTop: 8 }}>
                    These settings decide what kinds of homes appear in your feed.
                  </p>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <div className="field-grid">
                  <div className="form-field">
                    <label>Preferred localities</label>
                    <input
                      className="input"
                      placeholder="Chandkheda, Gota"
                      value={preferredLocalitiesText}
                      onChange={(event) => setPreferredLocalitiesText(event.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Max rent (INR)</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      type="number"
                      value={searchDraft?.max_rent_inr ?? ""}
                      onChange={(event) =>
                        updateSearchDraft((current) => ({
                          ...current,
                          max_rent_inr: Number(event.target.value) || null,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="field-grid">
                  <div className="form-field">
                    <label>Minimum BHK</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      type="number"
                      min={0}
                      step={0.5}
                      value={searchDraft?.min_bhk ?? ""}
                      onChange={(event) =>
                        updateSearchDraft((current) => ({
                          ...current,
                          min_bhk: Number(event.target.value) || null,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Maximum BHK</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      type="number"
                      min={0}
                      step={0.5}
                      value={searchDraft?.max_bhk ?? ""}
                      onChange={(event) =>
                        updateSearchDraft((current) => ({
                          ...current,
                          max_bhk: Number(event.target.value) || null,
                        }))
                      }
                    />
                  </div>
                </div>

                <MapboxLocationPicker
                  countryCode="in"
                  description="Pick the area where you want to rent. Only nearby locality is shared, not your exact selected point."
                  radiusKm={tenantSearchRadiusKm}
                  radiusLabel="Preferred search radius (km)"
                  session={session}
                  title="Rental search location"
                  value={tenantSearchLocation}
                  onRadiusChange={(value) => setTenantSearchRadiusKm(value)}
                  onChange={(nextLocation) => {
                    setTenantSearchLocation(nextLocation);
                    if (nextLocation.locality.trim()) {
                      const nextLocalities = Array.from(
                        new Set([...splitCsv(preferredLocalitiesText), nextLocation.locality.trim()])
                      );
                      setPreferredLocalitiesText(nextLocalities.join(", "));
                    }
                  }}
                />

                <div className="page-header" style={{ marginTop: 18, marginBottom: 12 }}>
                  <div>
                    <strong>Preferred property types</strong>
                  </div>
                </div>
                <div className="properties-toggle-grid">
                  {PROPERTY_TYPE_OPTIONS.map((option) => {
                    const active = Boolean(searchDraft?.property_types.includes(option.value));
                    return (
                      <button
                        className={`properties-toggle-card ${active ? "is-active" : "is-inactive"}`}
                        key={option.value}
                        onClick={() =>
                          toggleMultiValue(
                            searchDraft?.property_types ?? [],
                            option.value,
                            (next) =>
                              updateSearchDraft((current) => ({
                                ...current,
                                property_types: next,
                              }))
                          )
                        }
                        type="button"
                      >
                        <span>Type</span>
                        <strong>{option.label}</strong>
                      </button>
                    );
                  })}
                </div>

                <div className="page-header" style={{ marginTop: 18, marginBottom: 12 }}>
                  <div>
                    <strong>Preferred furnishing</strong>
                  </div>
                </div>
                <div className="properties-toggle-grid">
                  {FURNISHING_OPTIONS.map((option) => {
                    const active = Boolean(searchDraft?.furnishing_types.includes(option.value));
                    return (
                      <button
                        className={`properties-toggle-card ${active ? "is-active" : "is-inactive"}`}
                        key={option.value}
                        onClick={() =>
                          toggleMultiValue(
                            searchDraft?.furnishing_types ?? [],
                            option.value,
                            (next) =>
                              updateSearchDraft((current) => ({
                                ...current,
                                furnishing_types: next,
                              }))
                          )
                        }
                        type="button"
                      >
                        <span>Furnishing</span>
                        <strong>{option.label}</strong>
                      </button>
                    );
                  })}
                </div>

                <div className="properties-toggle-grid" style={{ marginTop: 18 }}>
                  {[
                    {
                      key: "verified",
                      label: "Verified listings only",
                      active: Boolean(searchDraft?.only_verified_listings),
                      onClick: () =>
                        updateSearchDraft((current) => ({
                          ...current,
                          only_verified_listings: !current.only_verified_listings,
                        })),
                    },
                    {
                      key: "owner",
                      label: "Only owner listings",
                      active: Boolean(searchDraft?.only_owner_listings),
                      onClick: () =>
                        updateSearchDraft((current) => ({
                          ...current,
                          only_owner_listings: !current.only_owner_listings,
                        })),
                    },
                    {
                      key: "parking",
                      label: "Parking required",
                      active: Boolean(searchDraft?.parking_required),
                      onClick: () =>
                        updateSearchDraft((current) => ({
                          ...current,
                          parking_required: !current.parking_required,
                        })),
                    },
                    {
                      key: "pets",
                      label: "Pet friendly homes",
                      active: searchDraft?.allows_pets === true,
                      onClick: () =>
                        updateSearchDraft((current) => ({
                          ...current,
                          allows_pets: current.allows_pets === true ? null : true,
                        })),
                    },
                  ].map((item) => (
                    <button
                      className={`properties-toggle-card ${item.active ? "is-active" : "is-inactive"}`}
                      key={item.key}
                      onClick={item.onClick}
                      type="button"
                    >
                      <span>Filter</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                </div>

                <div className="action-row properties-step-actions">
                  <button className="ghost-button" onClick={() => setCurrentStep(1)} type="button">
                    Back
                  </button>
                  <button className="primary-button" onClick={() => setCurrentStep(3)} type="button">
                    Continue to image
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <section className="property-editor property-editor-modern">
              <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                <div>
                  <strong>Step 3: Profile image and final actions</strong>
                  <p className="section-copy" style={{ marginTop: 8 }}>
                    Upload one clear face photo in 3:4 portrait. This is required before browsing
                    properties.
                  </p>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
                  <article
                    className={`property-image-slot-card ${profileImageUrl ? "is-filled" : ""} ${
                      !profileImageUrl ? "is-required-missing" : ""
                    }`}
                  >
                    <header>
                      <span>#1</span>
                      <small>required</small>
                    </header>
                    <button className="property-image-slot-preview" onClick={openImageEditor} type="button">
                      {profileImageUrl ? (
                        <img alt="Profile preview" src={previewImageSrc} />
                      ) : (
                        <span>Upload profile photo</span>
                      )}
                    </button>
                    <div className="property-image-slot-meta">
                      <strong>Profile portrait</strong>
                      <span>One clear face image in 3:4 portrait frame.</span>
                    </div>
                    <div className="property-image-slot-actions">
                      <button className="soft-button" onClick={openImageEditor} type="button">
                        {profileImageUrl ? "Replace" : "Add photo"}
                      </button>
                    </div>
                  </article>
                </div>

                <div className="hint" style={{ marginTop: 12 }}>
                  Your tenant profile cannot go live without exactly one required portrait image.
                </div>

                <div className="action-row properties-step-actions">
                  <button className="ghost-button" onClick={() => setCurrentStep(2)} type="button">
                    Back
                  </button>
                  <button className="primary-button" onClick={() => void handleSaveAndPreview()} type="button">
                    {tenantProfile?.id ? "Update and preview" : "Create and preview"}
                  </button>
                </div>

                {tenantProfile ? (
                  <button
                    className="properties-delete-banner"
                    onClick={() => void handleDeleteTenantProfile()}
                    type="button"
                  >
                    Delete tenant profile. You will need a new portrait photo before browsing again.
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      )}
      {imageEditor.open ? (
        <div className="properties-modal-backdrop">
          <section className="properties-modal-card">
            <header>
              <strong>Profile image</strong>
              <button className="ghost-button" onClick={closeImageEditor} type="button">
                Close
              </button>
            </header>

            <div className="field-stack">
              <div className="form-field">
                <label>Select image</label>
                <input
                  accept="image/*"
                  capture="user"
                  className="input"
                  onChange={(event) => handleImageFileSelect(event.target.files)}
                  type="file"
                />
              </div>

              <div
                className={`properties-crop-frame ${imageEditor.previewUrl ? "is-interactive" : ""}`}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
                onTouchStart={handleCropTouchStart}
                onTouchMove={handleCropTouchMove}
                onTouchEnd={handleCropTouchEnd}
                onTouchCancel={handleCropTouchEnd}
                onWheel={handleCropWheel}
                ref={cropFrameRef}
              >
                {imageEditor.previewUrl ? (
                  <img
                    alt="Profile crop preview"
                    src={imageEditor.previewUrl}
                    style={{
                      transform: `scale(${imageEditor.zoom})`,
                      objectPosition: `${50 + imageEditor.offsetX}% ${50 + imageEditor.offsetY}%`,
                    }}
                  />
                ) : (
                  <span>Select a face photo to preview and crop.</span>
                )}
              </div>

              <div className="properties-crop-help-row">
                <span className="hint">
                  Drag to position. Pinch on mobile or scroll on desktop to zoom.
                </span>
                <button className="soft-button" onClick={resetCropFrame} type="button">
                  Reset frame
                </button>
              </div>

              <div className="field-grid">
                <div className="form-field">
                  <label>Zoom</label>
                  <input
                    className="input"
                    max={2.4}
                    min={1}
                    step={0.05}
                    type="range"
                    value={imageEditor.zoom}
                    onChange={(event) =>
                      setImageEditor((current) => ({
                        ...current,
                        zoom: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Horizontal position</label>
                  <input
                    className="input"
                    max={40}
                    min={-40}
                    step={1}
                    type="range"
                    value={imageEditor.offsetX}
                    onChange={(event) =>
                      setImageEditor((current) => ({
                        ...current,
                        offsetX: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Vertical position</label>
                <input
                  className="input"
                  max={40}
                  min={-40}
                  step={1}
                  type="range"
                  value={imageEditor.offsetY}
                  onChange={(event) =>
                    setImageEditor((current) => ({
                      ...current,
                      offsetY: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <footer className="action-row" style={{ marginTop: 16 }}>
              <button className="ghost-button" onClick={closeImageEditor} type="button">
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={imageEditor.busy}
                onClick={() => void handleSaveProfileImage()}
                type="button"
              >
                {imageEditor.busy ? "Saving..." : "Save photo"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
