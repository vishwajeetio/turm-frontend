"use client";

import Link from "next/link";
import {
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { AppShell } from "@/components/app-shell";
import { AuthRequired } from "@/components/auth-required";
import { MapboxLocationPicker } from "@/components/mapbox-location-picker";
import { PropertyFeedCard, type PropertyFeedCardMediaSlide } from "@/components/property-feed-card";
import { useAuth } from "@/components/providers/auth-provider";
import {
  createListing,
  createProperty,
  deleteProperty,
  deletePropertyMedia,
  getAmenities,
  getListingEditor,
  listMyListings,
  reorderPropertyMedia,
  reverseGeoLocation,
  updateListing,
  updateProperty,
  updatePropertyMedia,
  uploadMedia
} from "@/lib/api";
import type {
  AmenityResponse,
  EditorMediaResponse,
  ListingCreate,
  ManagedListingCardResponse,
  PropertyCreate,
  RoleType
} from "@/lib/types";
import { useSecureMediaCache } from "@/lib/use-secure-media-cache";
import { splitCsv } from "@/lib/utils";

const MAX_TAG_LENGTH = 30;
const DEFAULT_CITY = "Ahmedabad";
const DEFAULT_STATE = "Gujarat";
const DRAFT_AUTOSAVE_DELAY_MS = 800;

const PROPERTY_TYPE_OPTIONS = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "HOUSE", label: "Independent house" },
  { value: "BUILDER_FLOOR", label: "Builder floor" },
  { value: "ROOM", label: "Room / Roommate" },
  { value: "STUDIO", label: "Studio" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "PG_CO_LIVING", label: "PG / Co-living" },
  { value: "SERVICE_APARTMENT", label: "Service apartment" }
];

type PropertyFlowStep = 1 | 2 | 3;

type MediaSlotEditorState = {
  open: boolean;
  slotIndex: number;
  existingAssetId: string | null;
  roomCategory: string;
  caption: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  file: File | null;
  previewUrl: string | null;
  busy: boolean;
};

type ListingChargesDraft = {
  electricityInr: number;
  waterInr: number;
  moveInInr: number;
  maintenanceInr: number;
  garbagePickupInr: number;
  electricityIncluded: boolean;
  waterIncluded: boolean;
  maintenanceIncluded: boolean;
  powerBackupIncluded: boolean;
  deliveryWindow: string;
  parkingCovered: boolean;
};

function HeaderIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function buildEmptyProperty(userId: string, role: RoleType): PropertyCreate {
  const listingSourceType = role === "BROKER" ? "BROKER" : "OWNER";
  return {
    owner_user_id: role === "OWNER" ? userId : null,
    broker_user_id: role === "BROKER" ? userId : null,
    created_by_user_id: userId,
    address: {
      line1: "",
      line2: "",
      building_name: "",
      street: "",
      locality: "",
      sublocality: "",
      landmark: "",
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      postal_code: "",
      country: "India",
      latitude: undefined,
      longitude: undefined
    },
    property_type: "APARTMENT",
    listing_source_type: listingSourceType,
    title: "",
    description: "",
    bhk: 1,
    bedrooms_count: 1,
    bathrooms_count: 1,
    balconies_count: 1,
    floor_number: 1,
    total_floors: 1,
    furnishing_type: "SEMI_FURNISHED",
    parking_type: "CAR",
    parking_slots: 1,
    is_gated_community: false,
    has_lift: false,
    internet_ready: true,
    has_air_conditioning: false,
    has_washing_machine: false,
    has_refrigerator: false,
    has_geyser: true,
    has_cupboards: true,
    has_modular_kitchen: true,
    amenity_items: [],
    extra_data: {
      exact_address_share_mode: "MATCH_APPROVAL",
      contact_share_mode: "MATCH_APPROVAL",
      is_top_floor: true,
      draft_mode: true
    }
  };
}

function buildEmptyListing(userId: string, role: RoleType): ListingCreate {
  return {
    property_id: "",
    owner_user_id: role === "OWNER" ? userId : null,
    broker_user_id: role === "BROKER" ? userId : null,
    created_by_user_id: userId,
    headline: "",
    description: "",
    monthly_rent_inr: 20000,
    maintenance_inr: 0,
    security_deposit_inr: 40000,
    brokerage_percentage: role === "BROKER" ? 1 : null,
    is_brokerage_negotiable: false,
    additional_charges: [],
    additional_charge_notes: "",
    preferred_tenant_types: [],
    preferred_occupations: [],
    is_rent_negotiable: false,
    is_verified: false,
    is_promoted: false,
    is_instant_chat_enabled: true,
    status: "ACTIVE",
    media_asset_ids: [],
    extra_data: {
      visibility_mode: "PUBLIC",
      exact_address_share_mode: "MATCH_APPROVAL",
      contact_share_mode: "MATCH_APPROVAL"
    }
  };
}

function buildRoomOptions(propertyDraft: PropertyCreate | null) {
  if (!propertyDraft) {
    return [
      { label: "Entry", value: "ENTRY" },
      { label: "Living room", value: "LIVING_ROOM" },
      { label: "Kitchen", value: "KITCHEN" }
    ];
  }

  const options = [
    { label: "Entry", value: "ENTRY" },
    { label: "Exterior view", value: "EXTERIOR_VIEW" },
    { label: "Living room", value: "LIVING_ROOM" },
    { label: "Dining room", value: "DINING_ROOM" },
    { label: "Kitchen", value: "KITCHEN" }
  ];

  for (let index = 1; index <= Math.max(propertyDraft.bedrooms_count, 1); index += 1) {
    options.push({ label: `Bedroom ${index}`, value: "BEDROOM" });
  }
  for (let index = 1; index <= Math.max(propertyDraft.bathrooms_count, 1); index += 1) {
    options.push({ label: `Washroom ${index}`, value: "WASHROOM" });
  }
  for (let index = 1; index <= Math.max(propertyDraft.balconies_count ?? 0, 0); index += 1) {
    options.push({ label: `Balcony ${index}`, value: "BALCONY" });
  }

  return options;
}

function normalizedBhkCount(bhk: number) {
  if (!Number.isFinite(bhk) || bhk <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(bhk));
}

function clampBhkInput(input: string) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  const clamped = Math.max(1, Math.min(parsed, 50));
  return Math.round(clamped * 2) / 2;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function minimumPropertyImagesForBhk(bhk: number) {
  return 4 + normalizedBhkCount(bhk) * 4;
}

function maximumPropertyImagesForBhk(bhk: number) {
  return 4 + normalizedBhkCount(bhk) * 8;
}

function sortAssets(assets: EditorMediaResponse[]) {
  return [...assets].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    return a.id.localeCompare(b.id);
  });
}

function normalizeImageAssetOrder(assets: EditorMediaResponse[]) {
  return sortAssets(assets).map((asset, index) => ({
    ...asset,
    sort_order: index,
    is_primary: index === 0
  }));
}

function defaultMediaSlotEditor(roomCategory: string): MediaSlotEditorState {
  return {
    open: false,
    slotIndex: 0,
    existingAssetId: null,
    roomCategory,
    caption: "",
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    file: null,
    previewUrl: null,
    busy: false
  };
}

function defaultChargesDraft(): ListingChargesDraft {
  return {
    electricityInr: 0,
    waterInr: 0,
    moveInInr: 0,
    maintenanceInr: 0,
    garbagePickupInr: 0,
    electricityIncluded: false,
    waterIncluded: false,
    maintenanceIncluded: false,
    powerBackupIncluded: false,
    deliveryWindow: "",
    parkingCovered: false
  };
}

function hydrateChargesDraft(listingDraft: ListingCreate | null): ListingChargesDraft {
  if (!listingDraft) {
    return defaultChargesDraft();
  }
  const draft = defaultChargesDraft();
  for (const charge of listingDraft.additional_charges) {
    const key = String(charge.key ?? "");
    const amount = Number(charge.amount_inr ?? 0) || 0;
    const included = Boolean(charge.included);
    if (key === "electricity") {
      draft.electricityInr = amount;
      draft.electricityIncluded = included;
    } else if (key === "water") {
      draft.waterInr = amount;
      draft.waterIncluded = included;
    } else if (key === "move_in") {
      draft.moveInInr = amount;
    } else if (key === "society_maintenance") {
      draft.maintenanceInr = amount;
      draft.maintenanceIncluded = included;
    } else if (key === "garbage_pickup") {
      draft.garbagePickupInr = amount;
    }
  }
  draft.powerBackupIncluded = Boolean(listingDraft.extra_data.power_backup_included);
  draft.deliveryWindow = String(listingDraft.extra_data.delivery_window ?? "");
  draft.parkingCovered = Boolean(listingDraft.extra_data.parking_covered);
  return draft;
}

function serializeChargesDraft(draft: ListingChargesDraft) {
  return [
    {
      key: "electricity",
      label: "Electricity",
      amount_inr: Math.max(0, Math.round(draft.electricityInr)),
      included: draft.electricityIncluded
    },
    {
      key: "water",
      label: "Water",
      amount_inr: Math.max(0, Math.round(draft.waterInr)),
      included: draft.waterIncluded
    },
    {
      key: "move_in",
      label: "Move-in charges",
      amount_inr: Math.max(0, Math.round(draft.moveInInr)),
      included: false
    },
    {
      key: "society_maintenance",
      label: "Society maintenance",
      amount_inr: Math.max(0, Math.round(draft.maintenanceInr)),
      included: draft.maintenanceIncluded
    },
    {
      key: "garbage_pickup",
      label: "Garbage pickup",
      amount_inr: Math.max(0, Math.round(draft.garbagePickupInr)),
      included: false
    }
  ];
}

function csvToDisplay(values: string[]) {
  return values.join(", ");
}

function normalizeListingMode(listing: ManagedListingCardResponse | undefined) {
  if (!listing) {
    return "DRAFT";
  }
  if (listing.status === "DRAFT") {
    return "DRAFT";
  }
  if (listing.visibility_mode === "PRIVATE") {
    return "PRIVATE";
  }
  if (listing.status === "PAUSED") {
    return "INACTIVE";
  }
  return "ACTIVE";
}

function formatListingModeLabel(listing: ManagedListingCardResponse | undefined) {
  const mode = normalizeListingMode(listing);
  if (mode === "PRIVATE") {
    return "private";
  }
  if (mode === "INACTIVE") {
    return "inactive";
  }
  if (mode === "ACTIVE") {
    return "active";
  }
  return "draft";
}

function sortManagedListings(items: ManagedListingCardResponse[]) {
  return [...items].sort((left, right) => {
    const leftDraft = left.status === "DRAFT" ? 0 : 1;
    const rightDraft = right.status === "DRAFT" ? 0 : 1;
    if (leftDraft !== rightDraft) {
      return leftDraft - rightDraft;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function PropertiesScreen() {
  const { activeRole, dashboard, loading, session } = useAuth();
  const { queuePrefetchMany, resolveUrl } = useSecureMediaCache({ concurrency: 4 });
  const [amenities, setAmenities] = useState<AmenityResponse[]>([]);
  const [listings, setListings] = useState<ManagedListingCardResponse[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [propertyDraft, setPropertyDraft] = useState<PropertyCreate | null>(null);
  const [listingDraft, setListingDraft] = useState<ListingCreate | null>(null);
  const [workingPropertyId, setWorkingPropertyId] = useState<string | null>(null);
  const [propertyMediaAssets, setPropertyMediaAssets] = useState<EditorMediaResponse[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargesDraft, setChargesDraft] = useState<ListingChargesDraft>(defaultChargesDraft);
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string>("Private listings");
  const [draggingMediaId, setDraggingMediaId] = useState<string | null>(null);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<PropertyFlowStep>(1);
  const [editMode, setEditMode] = useState(true);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewMobileDetailsExpanded, setPreviewMobileDetailsExpanded] = useState(false);
  const [deletePropertyModalOpen, setDeletePropertyModalOpen] = useState(false);
  const [deletePropertyInput, setDeletePropertyInput] = useState("");
  const propertyMenuRef = useRef<HTMLDivElement | null>(null);
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
  const hydratingRef = useRef(false);
  const propertyAutosaveTimerRef = useRef<number | null>(null);
  const listingAutosaveTimerRef = useRef<number | null>(null);

  const canManage = activeRole === "OWNER" || activeRole === "BROKER";
  const isPremium = dashboard?.active_subscription.plan_code === "PREMIUM";
  const roomOptions = useMemo(() => buildRoomOptions(propertyDraft), [propertyDraft]);
  const [slotEditor, setSlotEditor] = useState<MediaSlotEditorState>(() =>
    defaultMediaSlotEditor(roomOptions[0]?.value ?? "ENTRY")
  );

  const imageAssets = useMemo(
    () => normalizeImageAssetOrder(propertyMediaAssets.filter((asset) => asset.media_type === "IMAGE")),
    [propertyMediaAssets]
  );
  const minimumImageSlots = useMemo(
    () => minimumPropertyImagesForBhk(Number(propertyDraft?.bhk ?? 1)),
    [propertyDraft?.bhk]
  );
  const maximumImageSlots = useMemo(
    () => maximumPropertyImagesForBhk(Number(propertyDraft?.bhk ?? 1)),
    [propertyDraft?.bhk]
  );
  const slotCount = Math.max(maximumImageSlots, imageAssets.length);
  const slotAssets = useMemo(
    () => Array.from({ length: slotCount }, (_, index) => imageAssets[index] ?? null),
    [imageAssets, slotCount]
  );

  const selectedAmenityIds = useMemo(
    () => new Set(propertyDraft?.amenity_items.map((item) => item.amenity_id) ?? []),
    [propertyDraft?.amenity_items]
  );
  const sortedListings = useMemo(() => sortManagedListings(listings), [listings]);
  const selectedListingSummary = useMemo(
    () => listings.find((item) => item.listing_id === selectedListingId) ?? null,
    [listings, selectedListingId]
  );
  const isDraftListing = selectedListingSummary?.status === "DRAFT" || listingDraft?.status === "DRAFT";
  const selectedListingModeLabel = isDraftListing
    ? "draft"
    : formatListingModeLabel(selectedListingSummary ?? undefined);
  const showListingPreviewMode = Boolean(selectedListingSummary && !isDraftListing && !editMode);
  const deletePropertyName =
    propertyDraft?.title?.trim() ||
    listingDraft?.headline?.trim() ||
    "Property";

  const privateVisibilityEnabled = String(listingDraft?.extra_data.visibility_mode ?? "PUBLIC") === "PRIVATE";
  const maxSecurityDeposit = Math.max(0, (listingDraft?.monthly_rent_inr ?? 0) * 2);
  const previewSlides = useMemo<PropertyFeedCardMediaSlide[]>(
    () =>
      imageAssets.map((asset, index) => ({
        id: asset.id,
        src:
          resolveUrl(asset, "https://placehold.co/980x1280/0d1117/e6ecf3?text=Property") ??
          "https://placehold.co/980x1280/0d1117/e6ecf3?text=Property",
        alt: `${listingDraft?.headline || propertyDraft?.title || "Listing"} image ${index + 1}`,
        roomTag: asset.room_category,
        customTag: asset.caption,
      })),
    [imageAssets, listingDraft?.headline, propertyDraft?.title, resolveUrl]
  );

  useEffect(() => {
    queuePrefetchMany(imageAssets, 320);
  }, [imageAssets, queuePrefetchMany]);

  useEffect(() => {
    if (!session || !dashboard || !canManage) {
      return;
    }
    void Promise.all([getAmenities(session), listMyListings(session)])
      .then(([amenityItems, managedListings]) => {
        const nextListings = sortManagedListings(managedListings);
        setAmenities(amenityItems);
        setListings(nextListings);
        setSelectedListingId((current) => current ?? nextListings[0]?.listing_id ?? null);
      })
      .catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : "Unable to load property manager")
      );
  }, [canManage, dashboard, session]);

  function resetToNewDraft() {
    setWorkingPropertyId(null);
    setPropertyDraft(null);
    setListingDraft(null);
    setPropertyMediaAssets([]);
    setChargesDraft(defaultChargesDraft());
    setLocationEditorOpen(false);
    setPreviewImageIndex(0);
    setDeletePropertyModalOpen(false);
    setDeletePropertyInput("");
    setPreviewMobileDetailsExpanded(false);
    setEditMode(true);
    setCurrentStep(1);
    setSlotEditor(defaultMediaSlotEditor(roomOptions[0]?.value ?? "ENTRY"));
  }

  async function reloadEditor(listingId: string) {
    if (!session) {
      return;
    }
    hydratingRef.current = true;
    const response = await getListingEditor(session, listingId);
    setPropertyDraft(response.property);
    setListingDraft(response.listing);
    setWorkingPropertyId(response.listing.property_id);
    setPropertyMediaAssets(sortAssets(response.media_assets));
    setChargesDraft(hydrateChargesDraft(response.listing));
    setPreviewImageIndex(0);
    setPreviewMobileDetailsExpanded(false);
    setEditMode(response.listing.status === "DRAFT");
    setCurrentStep(response.listing.status === "DRAFT" ? 1 : 3);
    setSlotEditor(defaultMediaSlotEditor(roomOptions[0]?.value ?? "ENTRY"));
    setDeletePropertyModalOpen(false);
    setDeletePropertyInput("");
    window.setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
  }

  useEffect(() => {
    if (!dashboard?.user.id) {
      return;
    }
    if (!selectedListingId) {
      resetToNewDraft();
      return;
    }
    if (!session) {
      return;
    }
    void reloadEditor(selectedListingId).catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Unable to load listing editor")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, dashboard?.user.id, selectedListingId, session]);

  useEffect(() => {
    if (!slotEditor.open) {
      return;
    }
    if (!roomOptions.some((option) => option.value === slotEditor.roomCategory)) {
      setSlotEditor((current) => ({
        ...current,
        roomCategory: roomOptions[0]?.value ?? "ENTRY"
      }));
    }
  }, [roomOptions, slotEditor.open, slotEditor.roomCategory]);

  useEffect(() => {
    if (!propertyMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!propertyMenuRef.current) {
        return;
      }
      if (!propertyMenuRef.current.contains(event.target as Node)) {
        setPropertyMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPropertyMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [propertyMenuOpen]);

  useEffect(
    () => () => {
      if (propertyAutosaveTimerRef.current) {
        window.clearTimeout(propertyAutosaveTimerRef.current);
      }
      if (listingAutosaveTimerRef.current) {
        window.clearTimeout(listingAutosaveTimerRef.current);
      }
    },
    []
  );

  async function refreshListings(nextListingId?: string | null) {
    if (!session) {
      return;
    }
    const refreshed = sortManagedListings(await listMyListings(session));
    setListings(refreshed);
    setSelectedListingId(nextListingId ?? refreshed[0]?.listing_id ?? null);
  }

  async function handleCreateDraftWorkspace() {
    if (!session || !dashboard?.user.id) {
      return;
    }
    const role = activeRole ?? "OWNER";
    const propertyTemplate = buildEmptyProperty(dashboard.user.id, role);
    const listingTemplate = buildEmptyListing(dashboard.user.id, role);
    const draftName = `Draft ${new Date().toLocaleDateString("en-IN")}`;
    propertyTemplate.title = draftName;
    listingTemplate.headline = draftName;
    listingTemplate.status = "DRAFT";
    listingTemplate.extra_data.visibility_mode = "PUBLIC";
    setError(null);
    setStatus("Creating draft property...");
    try {
      const createdProperty = await createProperty(session, propertyTemplate);
      const createdListing = await createListing(session, {
        ...listingTemplate,
        property_id: createdProperty.id
      });
      await refreshListings(createdListing.id);
      await reloadEditor(createdListing.id);
      setPropertyMenuOpen(false);
      setStatus("Draft created. We auto-save as you edit.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create property draft");
    }
  }

  function canEditSlot(index: number) {
    if (index === 0) {
      return true;
    }
    for (let prior = 0; prior < index; prior += 1) {
      if (!slotAssets[prior]) {
        return false;
      }
    }
    return true;
  }

  function normalizeLocalMediaAssets(nextImageAssets: EditorMediaResponse[]) {
    const normalizedImages = normalizeImageAssetOrder(nextImageAssets);
    const nonImageAssets = propertyMediaAssets.filter((asset) => asset.media_type !== "IMAGE");
    return [...normalizedImages, ...nonImageAssets];
  }

  async function persistLocalMedia(nextImageAssets: EditorMediaResponse[]) {
    const normalized = normalizeLocalMediaAssets(nextImageAssets);
    setPropertyMediaAssets(normalized);
    if (!workingPropertyId || !session) {
      return;
    }
    const ids = normalizeImageAssetOrder(nextImageAssets).map((item) => item.id);
    if (!ids.length) {
      return;
    }
    await reorderPropertyMedia(session, workingPropertyId, ids);
  }

  function openUpgradeModal(reason: string) {
    setUpgradeReason(reason);
    setUpgradeModalOpen(true);
  }

  function openSlotEditor(slotIndex: number) {
    const existingAsset = slotAssets[slotIndex];
    if (!workingPropertyId) {
      setError("Save property first to unlock media uploads.");
      return;
    }
    if (!existingAsset && !canEditSlot(slotIndex)) {
      setError("Upload images in order from the first card.");
      return;
    }
    const cropMeta = (existingAsset?.crop_meta ?? {}) as Record<string, unknown>;
    setSlotEditor({
      open: true,
      slotIndex,
      existingAssetId: existingAsset?.id ?? null,
      roomCategory: existingAsset?.room_category ?? roomOptions[0]?.value ?? "ENTRY",
      caption: existingAsset?.caption ?? "",
      zoom: Number(cropMeta.zoom ?? 1) || 1,
      offsetX: Number(cropMeta.offset_x ?? 0) || 0,
      offsetY: Number(cropMeta.offset_y ?? 0) || 0,
      file: null,
      previewUrl: existingAsset?.delivery_url ?? null,
      busy: false
    });
  }

  function closeSlotEditor() {
    setSlotEditor(defaultMediaSlotEditor(roomOptions[0]?.value ?? "ENTRY"));
  }

  function handleSlotFileSelect(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSlotEditor((current) => ({
        ...current,
        file,
        previewUrl: typeof reader.result === "string" ? reader.result : current.previewUrl
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
    setSlotEditor((current) => ({
      ...current,
      offsetX: clampNumber(startOffsetX + horizontalStep, -40, 40),
      offsetY: clampNumber(startOffsetY + verticalStep, -40, 40)
    }));
  }

  function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!slotEditor.previewUrl) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }
    event.preventDefault();
    cropFrameRef.current?.setPointerCapture(event.pointerId);
    cropPointerStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: slotEditor.offsetX,
      startOffsetY: slotEditor.offsetY
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
    if (!slotEditor.previewUrl) {
      return;
    }
    if (event.touches.length >= 2) {
      const distance = touchDistance(event);
      cropTouchStateRef.current = {
        mode: "pinch",
        startDistance: Math.max(distance, 1),
        startZoom: slotEditor.zoom
      };
      return;
    }
    if (event.touches.length === 1) {
      cropTouchStateRef.current = {
        mode: "drag",
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startOffsetX: slotEditor.offsetX,
        startOffsetY: slotEditor.offsetY
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
      setSlotEditor((current) => ({
        ...current,
        zoom: Number(nextZoom.toFixed(2))
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
        startZoom: slotEditor.zoom
      };
      return;
    }
    if (event.touches.length === 1) {
      cropTouchStateRef.current = {
        mode: "drag",
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startOffsetX: slotEditor.offsetX,
        startOffsetY: slotEditor.offsetY
      };
      return;
    }
    cropTouchStateRef.current = null;
  }

  function handleCropWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!slotEditor.previewUrl) {
      return;
    }
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.07 : -0.07;
    setSlotEditor((current) => ({
      ...current,
      zoom: Number(clampNumber(current.zoom + step, 1, 2.4).toFixed(2))
    }));
  }

  function resetCropFrame() {
    setSlotEditor((current) => ({
      ...current,
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    }));
  }

  async function handleSaveSlotEditor() {
    if (!session || !workingPropertyId) {
      return;
    }
    const roomCategory = slotEditor.roomCategory || roomOptions[0]?.value;
    if (!roomCategory) {
      setError("Please select a room category.");
      return;
    }
    if (!slotEditor.file && !slotEditor.existingAssetId) {
      setError("Select an image before saving this card.");
      return;
    }

    setSlotEditor((current) => ({ ...current, busy: true }));
    setError(null);
    setStatus("Saving media...");
    const cropMeta = {
      frame: "3:4",
      zoom: Number(slotEditor.zoom.toFixed(2)),
      offset_x: Number(slotEditor.offsetX.toFixed(2)),
      offset_y: Number(slotEditor.offsetY.toFixed(2))
    };

    try {
      if (slotEditor.file) {
        const uploaded = await uploadMedia(session, {
          file: slotEditor.file,
          targetType: "PROPERTY",
          targetId: workingPropertyId,
          mediaType: "IMAGE",
          roomCategory,
          caption: slotEditor.caption.slice(0, MAX_TAG_LENGTH),
          sortOrder: slotEditor.slotIndex,
          isPrimary: slotEditor.slotIndex === 0,
          cropPreset: "PORTRAIT_3_4",
          captureOrientation: "PORTRAIT",
          cropMeta
        });

        if (slotEditor.existingAssetId) {
          await deletePropertyMedia(session, workingPropertyId, slotEditor.existingAssetId);
        }

        const remainingImages = imageAssets.filter((asset) => asset.id !== slotEditor.existingAssetId);
        const nextImageAssets = normalizeImageAssetOrder([
          ...remainingImages,
          {
            id: uploaded.media_asset_id,
            target_type: "PROPERTY",
            target_id: workingPropertyId,
            media_type: "IMAGE",
            sort_order: slotEditor.slotIndex,
            is_primary: slotEditor.slotIndex === 0,
            caption: slotEditor.caption.slice(0, MAX_TAG_LENGTH),
            room_category: roomCategory,
            capture_orientation: "PORTRAIT",
            crop_preset: "PORTRAIT_3_4",
            crop_meta: cropMeta,
            delivery_url: uploaded.delivery_url
          }
        ]);

        if (selectedListingId) {
          await reloadEditor(selectedListingId);
        } else {
          await persistLocalMedia(nextImageAssets);
        }
      } else if (slotEditor.existingAssetId) {
        await updatePropertyMedia(session, workingPropertyId, slotEditor.existingAssetId, {
          caption: slotEditor.caption.slice(0, MAX_TAG_LENGTH),
          room_category: roomCategory,
          sort_order: slotEditor.slotIndex,
          is_primary: slotEditor.slotIndex === 0,
          crop_meta: cropMeta
        });
        const nextImageAssets = normalizeImageAssetOrder(
          imageAssets.map((asset) =>
            asset.id === slotEditor.existingAssetId
              ? {
                  ...asset,
                  caption: slotEditor.caption.slice(0, MAX_TAG_LENGTH),
                  room_category: roomCategory,
                  crop_meta: cropMeta,
                  sort_order: slotEditor.slotIndex,
                  is_primary: slotEditor.slotIndex === 0
                }
              : asset
          )
        );
        if (selectedListingId) {
          await reloadEditor(selectedListingId);
        } else {
          await persistLocalMedia(nextImageAssets);
        }
      }
      setStatus("Media saved.");
      closeSlotEditor();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save media");
    } finally {
      setSlotEditor((current) => ({ ...current, busy: false }));
    }
  }

  async function handleDeleteMedia(assetId: string) {
    if (!session || !workingPropertyId) {
      return;
    }
    setError(null);
    setStatus("Removing image...");
    try {
      await deletePropertyMedia(session, workingPropertyId, assetId);
      const nextImageAssets = normalizeImageAssetOrder(imageAssets.filter((asset) => asset.id !== assetId));
      if (selectedListingId) {
        await reloadEditor(selectedListingId);
      } else {
        await persistLocalMedia(nextImageAssets);
      }
      setStatus("Image removed.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to remove image");
    }
  }

  async function reorderImages(nextImageOrder: EditorMediaResponse[]) {
    if (!session || !workingPropertyId) {
      return;
    }
    const normalized = normalizeImageAssetOrder(nextImageOrder);
    if (!normalized.length) {
      return;
    }
    await reorderPropertyMedia(
      session,
      workingPropertyId,
      normalized.map((item) => item.id)
    );
    if (selectedListingId) {
      await reloadEditor(selectedListingId);
      return;
    }
    setPropertyMediaAssets(normalizeLocalMediaAssets(normalized));
  }

  async function moveImage(assetId: string, direction: -1 | 1) {
    const currentIndex = imageAssets.findIndex((asset) => asset.id === assetId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= imageAssets.length) {
      return;
    }
    const nextOrder = [...imageAssets];
    const [item] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, item);
    try {
      await reorderImages(nextOrder);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to reorder images");
    }
  }

  async function handleDropImage(slotIndex: number) {
    if (!draggingMediaId) {
      return;
    }
    const fromIndex = imageAssets.findIndex((asset) => asset.id === draggingMediaId);
    if (fromIndex < 0) {
      setDraggingMediaId(null);
      return;
    }
    const toIndex = Math.max(0, Math.min(slotIndex, imageAssets.length - 1));
    if (toIndex === fromIndex) {
      setDraggingMediaId(null);
      return;
    }
    const nextOrder = [...imageAssets];
    const [item] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, item);
    try {
      await reorderImages(nextOrder);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to reorder images");
    } finally {
      setDraggingMediaId(null);
    }
  }

  async function handleUseCurrentLocation() {
    if (!session || !propertyDraft) {
      return;
    }
    if (!navigator.geolocation) {
      setError("Location permission is not available in this browser.");
      return;
    }
    setError(null);
    setStatus("Detecting your current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void reverseGeoLocation(session, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
          .then((feature) => {
            setPropertyDraft((current) =>
              current
                ? {
                    ...current,
                    address: {
                      ...current.address,
                      line1: feature.name || current.address.line1,
                      locality: feature.locality || current.address.locality,
                      city: feature.city || current.address.city,
                      state: feature.state || current.address.state,
                      postal_code: feature.postal_code || current.address.postal_code,
                      country: feature.country || current.address.country,
                      formatted_address: feature.full_address || current.address.formatted_address,
                      latitude: feature.latitude,
                      longitude: feature.longitude
                    }
                  }
                : current
            );
            setStatus("Current location updated.");
          })
          .catch((nextError) =>
            setError(
              nextError instanceof Error
                ? nextError.message
                : "Unable to resolve current location into an address."
            )
          );
      },
      (nextError) => {
        setError(nextError.message || "Unable to access current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }

  function handleTogglePrivateVisibility() {
    if (!listingDraft) {
      return;
    }
    if (!isPremium) {
      openUpgradeModal("Private listing visibility");
      return;
    }
    setListingDraft({
      ...listingDraft,
      extra_data: {
        ...listingDraft.extra_data,
        visibility_mode: privateVisibilityEnabled ? "PUBLIC" : "PRIVATE"
      }
    });
  }

  async function persistPropertyDraft(nextDraft: PropertyCreate) {
    if (!session || !workingPropertyId) {
      return;
    }
    const isTopFloor =
      (nextDraft.floor_number ?? 0) > 0 &&
      nextDraft.floor_number === nextDraft.total_floors;
    await updateProperty(session, workingPropertyId, {
      ...nextDraft,
      extra_data: {
        ...nextDraft.extra_data,
        is_top_floor: isTopFloor
      }
    });
  }

  async function persistListingDraft(nextDraft: ListingCreate, statusOverride?: ListingCreate["status"]) {
    if (!session || !workingPropertyId || !selectedListingId) {
      return;
    }
    const mediaCount = imageAssets.length;
    if (statusOverride && statusOverride !== "DRAFT") {
      if (mediaCount < minimumImageSlots) {
        throw new Error(
          `At least ${minimumImageSlots} images are required before publishing this ${propertyDraft?.bhk} BHK listing.`
        );
      }
      if (mediaCount > maximumImageSlots) {
        throw new Error(`This listing supports up to ${maximumImageSlots} images for current BHK.`);
      }
    }
    const normalizedDeposit = Math.max(0, Math.min(nextDraft.security_deposit_inr, maxSecurityDeposit));
    const nextStatus = statusOverride ?? nextDraft.status;
    const nextVisibility = privateVisibilityEnabled ? "PRIVATE" : "PUBLIC";
    await updateListing(session, selectedListingId, {
      ...nextDraft,
      property_id: workingPropertyId,
      status: nextStatus,
      security_deposit_inr: normalizedDeposit,
      media_asset_ids: imageAssets.map((asset) => asset.id),
      additional_charges: serializeChargesDraft(chargesDraft),
      extra_data: {
        ...nextDraft.extra_data,
        visibility_mode: nextVisibility,
        delivery_window: chargesDraft.deliveryWindow,
        parking_covered: chargesDraft.parkingCovered,
        power_backup_included: chargesDraft.powerBackupIncluded
      }
    });
    setListings((current) =>
      current.map((listing) =>
        listing.listing_id === selectedListingId
          ? {
              ...listing,
              headline: nextDraft.headline,
              title: propertyDraft?.title || listing.title,
              monthly_rent_inr: nextDraft.monthly_rent_inr,
              security_deposit_inr: normalizedDeposit,
              status: nextStatus,
              visibility_mode: nextVisibility
            }
          : listing
      )
    );
  }

  useEffect(() => {
    if (!propertyDraft || !workingPropertyId || !editMode || hydratingRef.current) {
      return;
    }
    if (propertyAutosaveTimerRef.current) {
      window.clearTimeout(propertyAutosaveTimerRef.current);
    }
    propertyAutosaveTimerRef.current = window.setTimeout(() => {
      void persistPropertyDraft(propertyDraft).catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : "Unable to auto-save property draft")
      );
    }, DRAFT_AUTOSAVE_DELAY_MS);
    return () => {
      if (propertyAutosaveTimerRef.current) {
        window.clearTimeout(propertyAutosaveTimerRef.current);
      }
    };
  }, [editMode, propertyDraft, workingPropertyId]);

  useEffect(() => {
    if (!listingDraft || !selectedListingId || !editMode || hydratingRef.current) {
      return;
    }
    if (listingAutosaveTimerRef.current) {
      window.clearTimeout(listingAutosaveTimerRef.current);
    }
    listingAutosaveTimerRef.current = window.setTimeout(() => {
      void persistListingDraft(listingDraft).catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : "Unable to auto-save listing draft")
      );
    }, DRAFT_AUTOSAVE_DELAY_MS);
    return () => {
      if (listingAutosaveTimerRef.current) {
        window.clearTimeout(listingAutosaveTimerRef.current);
      }
    };
  }, [chargesDraft, editMode, listingDraft, selectedListingId]);

  async function handleSaveAndPreview() {
    if (!listingDraft || !selectedListingId) {
      return;
    }
    const nextStatus: ListingCreate["status"] = isDraftListing ? "ACTIVE" : listingDraft.status;
    setError(null);
    setStatus(isDraftListing ? "Creating listing..." : "Updating listing...");
    try {
      await persistListingDraft(
        {
          ...listingDraft,
          status: nextStatus
        },
        nextStatus
      );
      await refreshListings(selectedListingId);
      await reloadEditor(selectedListingId);
      setEditMode(false);
      setCurrentStep(3);
      setPreviewImageIndex(0);
      setStatus(isDraftListing ? "Listing created. Showing tenant feed preview." : "Listing updated. Showing tenant feed preview.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save listing");
    }
  }

  async function handleDeletePropertyConfirmed() {
    if (!session || !workingPropertyId) {
      return;
    }
    if (deletePropertyInput.trim() !== deletePropertyName) {
      setError("Property name did not match. Please type the exact name.");
      return;
    }
    setError(null);
    setStatus("Deleting property...");
    try {
      await deleteProperty(session, workingPropertyId);
      setDeletePropertyModalOpen(false);
      setDeletePropertyInput("");
      resetToNewDraft();
      await refreshListings();
      setStatus("Property deleted.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete property");
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Properties"
        eyebrow="Loading"
        description="Loading your listings, media manifest, and settings."
      >
        <div className="empty-panel">Loading property manager…</div>
      </AppShell>
    );
  }

  if (!session || !dashboard) {
    return (
      <div className="page-shell" style={{ padding: "32px 0" }}>
        <AuthRequired
          title="Property management requires sign in"
          description="Use phone sign in to create, edit, and publish listings."
        />
      </div>
    );
  }

  if (!canManage) {
    return (
      <AppShell
        title="Properties"
        eyebrow="Management"
        description="Switch to owner or broker role to manage listings."
      >
        <div className="empty-panel">Use the role switcher and move into Owner or Broker mode.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Properties"
      eyebrow="Property management"
      description="Create property, arrange media cards, set location and charges, then publish the listing exactly how tenants will see it."
      showHero={false}
      headerActions={({ closeMenu }) => (
        <>
          <Link
            aria-label="Feed"
            className="ultra-feed-icon-button ultra-feed-header-action-button properties-feed-link"
            href="/"
          >
            <HeaderIcon path="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-9.2a1 1 0 1 0-2 0V19H5V5h8.7a1 1 0 1 0 0-2H4.5zm14.8.2a1 1 0 0 0-1.4 0l-6.7 6.7a1 1 0 0 0-.27.51l-.6 2.4a1 1 0 0 0 1.22 1.22l2.4-.6a1 1 0 0 0 .5-.27l6.7-6.7a1 1 0 0 0 0-1.4l-1.1-1.1z" />
            <span className="ultra-feed-action-label">Feed</span>
          </Link>

          <div className="properties-header-dropdown-shell" ref={propertyMenuRef}>
            <button
              className="ultra-feed-icon-button ultra-feed-header-action-button properties-menu-trigger"
              onClick={() => {
                closeMenu();
                setPropertyMenuOpen((current) => !current);
              }}
              type="button"
            >
              <HeaderIcon path="M10.5 3a7.5 7.5 0 0 0-7.49 7.08A6 6 0 0 0 3 10.5 6.5 6.5 0 0 0 9.5 17h8a3.5 3.5 0 1 0-.37-6.98A5.5 5.5 0 0 0 10.5 3zm-.5 6a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H7a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1z" />
              <span className="ultra-feed-action-label">Properties</span>
            </button>
            <div className={`properties-dropdown-menu ${propertyMenuOpen ? "is-open" : ""}`}>
              <button
                className="properties-dropdown-item"
                onClick={() => void handleCreateDraftWorkspace()}
                type="button"
              >
                <strong>Create property</strong>
                <span>New draft</span>
              </button>
              {sortedListings.map((listing) => (
                <button
                  className={`properties-dropdown-item ${selectedListingId === listing.listing_id ? "is-active" : ""}`}
                  key={listing.listing_id}
                  onClick={() => {
                    setSelectedListingId(listing.listing_id);
                    setPropertyMenuOpen(false);
                  }}
                  type="button"
                >
                  <strong>
                    {listing.title || listing.headline}
                    <small className={`properties-status-tag mode-${formatListingModeLabel(listing)}`}>
                      {formatListingModeLabel(listing)}
                    </small>
                  </strong>
                  <span>{listing.bhk} BHK · {listing.city}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      actions={null}
    >
      {status ? (
        <div className="surface">
          <div className="hint">{status}</div>
        </div>
      ) : null}
      {error ? (
        <div className="surface">
          <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div>
        </div>
      ) : null}

      {propertyDraft && listingDraft ? (
        <>
          {showListingPreviewMode ? (
            <section className="property-editor property-editor-modern properties-preview-page">
              <div className="properties-preview-title-row">
                <div>
                  <strong>{listingDraft.headline || propertyDraft.title || "Listing preview"}</strong>
                  <p className="section-copy" style={{ marginTop: 8 }}>
                    This is the same card model tenants will see in feed.
                  </p>
                </div>
              </div>
              <div className="properties-preview-card-stage">
                <PropertyFeedCard
                  activeImageIndex={Math.min(previewImageIndex, Math.max(previewSlides.length - 1, 0))}
                  chips={[
                    `${propertyDraft.bhk} BHK`,
                    propertyDraft.furnishing_type.replaceAll("_", " "),
                    `₹${listingDraft.monthly_rent_inr.toLocaleString("en-IN")} / month`,
                    `Deposit ₹${listingDraft.security_deposit_inr.toLocaleString("en-IN")}`,
                    selectedListingModeLabel,
                  ]}
                  className="properties-feed-preview-card"
                  fallbackReason="Exact address and contact details stay hidden until match approval in chat."
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
                        <span>Edit listing</span>
                      </button>
                      {selectedListingId ? (
                        <Link
                          className="ultra-feed-action-button ultra-feed-action-pill ultra-feed-action-pill-primary"
                          href={`/feed?mode=tenants&listingId=${selectedListingId}`}
                        >
                          <HeaderIcon path="M4 4a2 2 0 0 0-2 2v15.5a.5.5 0 0 0 .82.39L7.67 18H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4zm1 4h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2zm0 4h10a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2z" />
                          <span>Find tenants</span>
                        </Link>
                      ) : null}
                    </>
                  }
                  headline={listingDraft.headline || propertyDraft.title || "Listing"}
                  localityLine={`${propertyDraft.address.locality ? `${propertyDraft.address.locality}, ` : ""}${propertyDraft.address.city}, ${propertyDraft.address.state}`}
                  media={previewSlides}
                  mobileDetailsExpanded={previewMobileDetailsExpanded}
                  onImageIndexChange={setPreviewImageIndex}
                  onMobileDetailsExpandedChange={setPreviewMobileDetailsExpanded}
                  reasons={[
                    `${propertyDraft.property_type.replaceAll("_", " ")} · ${propertyDraft.furnishing_type.replaceAll("_", " ")}`,
                    "Exact address shared only after visit confirmation.",
                    "Contact details shared only from matched chat thread.",
                  ]}
                  reasonsTitle="Highlights"
                  score={{ value: "Preview", label: "tenant card" }}
                  stats={[
                    { label: "Bedrooms", value: String(propertyDraft.bedrooms_count) },
                    { label: "Washrooms", value: String(propertyDraft.bathrooms_count) },
                    { label: "Floor", value: String(propertyDraft.floor_number ?? "-") },
                    { label: "Status", value: selectedListingModeLabel },
                  ]}
                />
              </div>
            </section>
          ) : (
            <div className="field-stack">
              <section className="property-editor property-editor-modern">
                <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                  <div>
                    <strong>
                      {propertyDraft.title || "Untitled property"}
                      <small className={`properties-status-tag mode-${selectedListingModeLabel}`}>
                        {selectedListingModeLabel}
                      </small>
                    </strong>
                    <p className="section-copy" style={{ marginTop: 8 }}>
                      {isDraftListing
                        ? "Draft autosaves while you complete the 3-step flow."
                        : "Editing is live. Changes auto-save and are reflected immediately."}
                    </p>
                  </div>
                  <div className="inline-stack">
                    {!isDraftListing ? (
                      <button className="soft-button" onClick={() => setEditMode(false)} type="button">
                        Back to preview
                      </button>
                    ) : null}
                    {selectedListingId ? (
                      <Link className="ghost-button" href={`/feed?mode=tenants&listingId=${selectedListingId}`}>
                        Browse tenants
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="properties-stepper">
                  {[1, 2, 3].map((step) => (
                    <button
                      className={`properties-step-pill ${currentStep === step ? "is-active" : ""}`}
                      key={`step-${step}`}
                      onClick={() => setCurrentStep(step as PropertyFlowStep)}
                      type="button"
                    >
                      {step === 1 ? "Basic details" : step === 2 ? "Listing settings" : "Images & publish"}
                    </button>
                  ))}
                </div>
              </section>

              {currentStep === 1 ? (
                <section className="property-editor property-editor-modern">
                  <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                    <div>
                      <strong>Step 1: Property basics</strong>
                      <p className="section-copy" style={{ marginTop: 8 }}>
                        Role is locked after draft creation. To switch owner/broker role, delete and recreate.
                      </p>
                    </div>
                  </div>
                  <div style={{ padding: 18 }}>
                    <div className="field-grid">
                      <div className="form-field">
                        <label>Property title</label>
                        <input
                          className="input"
                          value={propertyDraft.title}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              title: event.target.value
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Source role</label>
                        <select className="select" disabled value={propertyDraft.listing_source_type}>
                          <option value="OWNER">Owner</option>
                          <option value="BROKER">Broker</option>
                        </select>
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Property type</label>
                        <select
                          className="select"
                          value={propertyDraft.property_type}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              property_type: event.target.value
                            })
                          }
                        >
                          {PROPERTY_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label>BHK (1 to 50, halves allowed)</label>
                        <input
                          className="input"
                          inputMode="decimal"
                          max={50}
                          min={1}
                          step={0.5}
                          type="number"
                          value={propertyDraft.bhk}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              bhk: clampBhkInput(event.target.value)
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Bedrooms</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={propertyDraft.bedrooms_count}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              bedrooms_count: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Washrooms</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={propertyDraft.bathrooms_count}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              bathrooms_count: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Balconies</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={propertyDraft.balconies_count ?? 0}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              balconies_count: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Floor number</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={propertyDraft.floor_number ?? 1}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              floor_number: Math.max(0, Number(event.target.value) || 0),
                              extra_data: {
                                ...propertyDraft.extra_data,
                                is_top_floor:
                                  (Number(event.target.value) || 0) === (propertyDraft.total_floors ?? 0)
                              }
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Total floors</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={propertyDraft.total_floors ?? 1}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              total_floors: Math.max(1, Number(event.target.value) || 1),
                              extra_data: {
                                ...propertyDraft.extra_data,
                                is_top_floor:
                                  (propertyDraft.floor_number ?? 0) === (Number(event.target.value) || 1)
                              }
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Furnishing</label>
                        <select
                          className="select"
                          value={propertyDraft.furnishing_type}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              furnishing_type: event.target.value
                            })
                          }
                        >
                          <option value="UNFURNISHED">Unfurnished</option>
                          <option value="SEMI_FURNISHED">Semi-furnished</option>
                          <option value="FULLY_FURNISHED">Fully furnished</option>
                        </select>
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Parking type</label>
                        <select
                          className="select"
                          value={propertyDraft.parking_type ?? "NONE"}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              parking_type: event.target.value
                            })
                          }
                        >
                          <option value="NONE">No parking</option>
                          <option value="TWO_WHEELER">Two wheeler</option>
                          <option value="CAR">Car</option>
                          <option value="BOTH">Car + two wheeler</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label>Parking slots</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={propertyDraft.parking_slots ?? 1}
                          onChange={(event) =>
                            setPropertyDraft({
                              ...propertyDraft,
                              parking_slots: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Description</label>
                      <textarea
                        className="textarea"
                        value={propertyDraft.description ?? ""}
                        onChange={(event) =>
                          setPropertyDraft({
                            ...propertyDraft,
                            description: event.target.value
                          })
                        }
                      />
                    </div>

                    <div className="properties-toggle-grid">
                      {[
                        ["is_gated_community", "Gated community"],
                        ["has_lift", "Lift"],
                        ["internet_ready", "Internet ready"],
                        ["has_air_conditioning", "Air conditioning"],
                        ["has_washing_machine", "Washing machine"],
                        ["has_refrigerator", "Refrigerator"],
                        ["has_geyser", "Geyser"],
                        ["has_cupboards", "Cupboards"],
                        ["has_modular_kitchen", "Modular kitchen"]
                      ].map(([key, label]) => {
                        const active = Boolean(propertyDraft[key as keyof PropertyCreate]);
                        return (
                          <button
                            className={`properties-toggle-card ${active ? "is-active" : "is-inactive"}`}
                            key={key}
                            onClick={() =>
                              setPropertyDraft({
                                ...propertyDraft,
                                [key]: !active
                              })
                            }
                            type="button"
                          >
                            <span>{active ? "Available" : "Not available"}</span>
                            <strong>{label}</strong>
                          </button>
                        );
                      })}
                    </div>

                    <div className="form-field" style={{ marginTop: 14 }}>
                      <label>Amenities</label>
                      <div className="role-switcher">
                        {amenities.map((amenity) => {
                          const active = selectedAmenityIds.has(amenity.id);
                          return (
                            <button
                              className={`pill-button ${active ? "is-active" : ""}`}
                              key={amenity.id}
                              onClick={() =>
                                setPropertyDraft({
                                  ...propertyDraft,
                                  amenity_items: active
                                    ? propertyDraft.amenity_items.filter((item) => item.amenity_id !== amenity.id)
                                    : [...propertyDraft.amenity_items, { amenity_id: amenity.id, is_highlighted: true }]
                                })
                              }
                              type="button"
                            >
                              {amenity.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="property-location-shell">
                      <div className="page-header" style={{ marginBottom: 8 }}>
                        <div>
                          <strong>Location</strong>
                          <p className="section-copy" style={{ marginTop: 8 }}>
                            Exact address is stored securely. Tenants only see approximate locality until you approve sharing in chat.
                          </p>
                        </div>
                        <div className="inline-stack">
                          <button
                            className="soft-button"
                            onClick={() => setLocationEditorOpen((current) => !current)}
                            type="button"
                          >
                            {locationEditorOpen ? "Hide location editor" : "Edit location"}
                          </button>
                          <button className="ghost-button" onClick={() => void handleUseCurrentLocation()} type="button">
                            Use current location
                          </button>
                        </div>
                      </div>

                      {locationEditorOpen ? (
                        <div className="field-stack">
                          <MapboxLocationPicker
                            countryCode="in"
                            description="Search society/building, pick a map pin, or use current location."
                            exactAddressRequired
                            session={session}
                            title="Property map location"
                            value={{
                              latitude: propertyDraft.address.latitude ?? null,
                              longitude: propertyDraft.address.longitude ?? null,
                              line1: propertyDraft.address.line1,
                              locality: propertyDraft.address.locality ?? "",
                              city: propertyDraft.address.city,
                              state: propertyDraft.address.state,
                              postalCode: propertyDraft.address.postal_code,
                              country: propertyDraft.address.country,
                              fullAddress: propertyDraft.address.formatted_address ?? ""
                            }}
                            onChange={(location) =>
                              setPropertyDraft({
                                ...propertyDraft,
                                address: {
                                  ...propertyDraft.address,
                                  line1: location.line1,
                                  locality: location.locality || propertyDraft.address.locality,
                                  city: location.city || propertyDraft.address.city,
                                  state: location.state || propertyDraft.address.state,
                                  postal_code: location.postalCode || propertyDraft.address.postal_code,
                                  country: location.country || propertyDraft.address.country,
                                  formatted_address: location.fullAddress || propertyDraft.address.formatted_address,
                                  latitude: location.latitude ?? undefined,
                                  longitude: location.longitude ?? undefined
                                }
                              })
                            }
                          />

                          <div className="field-grid">
                            <div className="form-field">
                              <label>House / apartment number</label>
                              <input
                                className="input"
                                value={propertyDraft.address.line1}
                                onChange={(event) =>
                                  setPropertyDraft({
                                    ...propertyDraft,
                                    address: {
                                      ...propertyDraft.address,
                                      line1: event.target.value
                                    }
                                  })
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label>Society / complex name</label>
                              <input
                                className="input"
                                value={propertyDraft.address.building_name ?? ""}
                                onChange={(event) =>
                                  setPropertyDraft({
                                    ...propertyDraft,
                                    address: {
                                      ...propertyDraft.address,
                                      building_name: event.target.value
                                    }
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="field-grid">
                            <div className="form-field">
                              <label>Locality</label>
                              <input
                                className="input"
                                value={propertyDraft.address.locality ?? ""}
                                onChange={(event) =>
                                  setPropertyDraft({
                                    ...propertyDraft,
                                    address: {
                                      ...propertyDraft.address,
                                      locality: event.target.value
                                    }
                                  })
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label>Landmark</label>
                              <input
                                className="input"
                                value={propertyDraft.address.landmark ?? ""}
                                onChange={(event) =>
                                  setPropertyDraft({
                                    ...propertyDraft,
                                    address: {
                                      ...propertyDraft.address,
                                      landmark: event.target.value
                                    }
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="hint">
                          {propertyDraft.address.formatted_address ||
                            `${propertyDraft.address.locality || "No locality selected"}, ${propertyDraft.address.city}`}
                        </div>
                      )}
                    </div>

                    <div className="action-row properties-step-actions">
                      <button className="primary-button" onClick={() => setCurrentStep(2)} type="button">
                        Continue to listing settings
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              {currentStep === 2 ? (
                <section className="property-editor property-editor-modern">
                  <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                    <div>
                      <strong>Step 2: Rent and listing settings</strong>
                      <p className="section-copy" style={{ marginTop: 8 }}>
                        Configure pricing, charges, preferred tenant profile, and listing visibility.
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: 18 }}>
                    <div className="field-grid">
                      <div className="form-field">
                        <label>Headline</label>
                        <input
                          className="input"
                          value={listingDraft.headline}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              headline: event.target.value
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Monthly rent (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={listingDraft.monthly_rent_inr}
                          onChange={(event) => {
                            const nextRent = Math.max(0, Number(event.target.value) || 0);
                            setListingDraft({
                              ...listingDraft,
                              monthly_rent_inr: nextRent,
                              security_deposit_inr: Math.min(listingDraft.security_deposit_inr, nextRent * 2)
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Security deposit (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={listingDraft.security_deposit_inr}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              security_deposit_inr: Math.max(
                                0,
                                Math.min(Number(event.target.value) || 0, maxSecurityDeposit)
                              )
                            })
                          }
                        />
                        <div className="hint">Max two months rent. Cap: ₹{maxSecurityDeposit.toLocaleString("en-IN")}</div>
                      </div>
                      <div className="form-field">
                        <label>Maintenance (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={listingDraft.maintenance_inr}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              maintenance_inr: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Brokerage %</label>
                        <input
                          className="input"
                          inputMode="decimal"
                          type="number"
                          value={listingDraft.brokerage_percentage ?? ""}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              brokerage_percentage: Number(event.target.value) || null
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Status</label>
                        <select
                          className="select"
                          value={listingDraft.status}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              status: event.target.value as ListingCreate["status"]
                            })
                          }
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="PAUSED">Paused</option>
                          <option value="DRAFT">Draft</option>
                        </select>
                      </div>
                    </div>

                    <div className="properties-charge-grid">
                      <div className="form-field">
                        <label>Electricity charge (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={chargesDraft.electricityInr}
                          onChange={(event) =>
                            setChargesDraft({
                              ...chargesDraft,
                              electricityInr: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Water charge (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={chargesDraft.waterInr}
                          onChange={(event) =>
                            setChargesDraft({
                              ...chargesDraft,
                              waterInr: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Move-in charge (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={chargesDraft.moveInInr}
                          onChange={(event) =>
                            setChargesDraft({
                              ...chargesDraft,
                              moveInInr: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Society maintenance (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={chargesDraft.maintenanceInr}
                          onChange={(event) =>
                            setChargesDraft({
                              ...chargesDraft,
                              maintenanceInr: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Garbage pickup (INR)</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          type="number"
                          value={chargesDraft.garbagePickupInr}
                          onChange={(event) =>
                            setChargesDraft({
                              ...chargesDraft,
                              garbagePickupInr: Math.max(0, Number(event.target.value) || 0)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Society delivery timing</label>
                        <input
                          className="input"
                          placeholder="Example: 8 AM to 10 PM"
                          value={chargesDraft.deliveryWindow}
                          onChange={(event) =>
                            setChargesDraft({
                              ...chargesDraft,
                              deliveryWindow: event.target.value
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="properties-toggle-grid">
                      {[
                        ["electricityIncluded", "Electricity included in rent"],
                        ["waterIncluded", "Water included in rent"],
                        ["maintenanceIncluded", "Maintenance included in rent"],
                        ["powerBackupIncluded", "Power backup available"],
                        ["parkingCovered", "Covered parking"]
                      ].map(([key, label]) => {
                        const active = Boolean(chargesDraft[key as keyof ListingChargesDraft]);
                        return (
                          <button
                            className={`properties-toggle-card ${active ? "is-active" : "is-inactive"}`}
                            key={key}
                            onClick={() =>
                              setChargesDraft({
                                ...chargesDraft,
                                [key]: !active
                              })
                            }
                            type="button"
                          >
                            <span>{active ? "Yes" : "No"}</span>
                            <strong>{label}</strong>
                          </button>
                        );
                      })}
                    </div>

                    <div className="field-grid">
                      <div className="form-field">
                        <label>Preferred tenant types</label>
                        <input
                          className="input"
                          value={csvToDisplay(listingDraft.preferred_tenant_types)}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              preferred_tenant_types: splitCsv(event.target.value)
                            })
                          }
                        />
                      </div>
                      <div className="form-field">
                        <label>Preferred occupations</label>
                        <input
                          className="input"
                          value={csvToDisplay(listingDraft.preferred_occupations)}
                          onChange={(event) =>
                            setListingDraft({
                              ...listingDraft,
                              preferred_occupations: splitCsv(event.target.value)
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Listing description</label>
                      <textarea
                        className="textarea"
                        value={listingDraft.description ?? ""}
                        onChange={(event) =>
                          setListingDraft({
                            ...listingDraft,
                            description: event.target.value
                          })
                        }
                      />
                    </div>

                    <div className="action-row" style={{ marginTop: 14 }}>
                      <button
                        className={`soft-button ${listingDraft.status === "PAUSED" ? "is-active" : ""}`}
                        onClick={() =>
                          setListingDraft({
                            ...listingDraft,
                            status: listingDraft.status === "PAUSED" ? "ACTIVE" : "PAUSED"
                          })
                        }
                        type="button"
                      >
                        {listingDraft.status === "PAUSED" ? "Activate listing" : "Deactivate listing"}
                      </button>
                      <button
                        className={`soft-button ${privateVisibilityEnabled ? "is-active" : ""}`}
                        onClick={handleTogglePrivateVisibility}
                        type="button"
                      >
                        {privateVisibilityEnabled ? "Incognito enabled" : "Enable incognito"}
                      </button>
                    </div>
                    <div className="hint" style={{ marginTop: 8 }}>
                      Incognito is premium-only and shows listing only to tenants you like.
                    </div>

                    <div className="action-row properties-step-actions">
                      <button className="ghost-button" onClick={() => setCurrentStep(1)} type="button">
                        Back
                      </button>
                      <button className="primary-button" onClick={() => setCurrentStep(3)} type="button">
                        Continue to images
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              {currentStep === 3 ? (
                <section className="property-editor property-editor-modern">
                  <div className="page-header" style={{ padding: 18, marginBottom: 0 }}>
                    <div>
                      <strong>Step 3: Images and final actions</strong>
                      <p className="section-copy" style={{ marginTop: 8 }}>
                        Upload in order, arrange image cards, then publish draft or delete it.
                      </p>
                    </div>
                    <div className="hint">
                      Min {minimumImageSlots} · Max {maximumImageSlots} images for current BHK
                    </div>
                  </div>

                  <div style={{ padding: 18 }}>
                    <div className="property-image-slot-grid">
                      {slotAssets.map((asset, slotIndex) => {
                        const requiredSlot = slotIndex < minimumImageSlots;
                        const canUpload = canEditSlot(slotIndex) || Boolean(asset);
                        return (
                          <article
                            className={`property-image-slot-card ${
                              asset ? "is-filled" : ""
                            } ${requiredSlot && !asset ? "is-required-missing" : ""} ${
                              !canUpload ? "is-locked" : ""
                            }`}
                            key={`slot-${slotIndex}-${asset?.id ?? "empty"}`}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => void handleDropImage(slotIndex)}
                          >
                            <header>
                              <span>#{slotIndex + 1}</span>
                              {requiredSlot ? <small>required</small> : <small>optional</small>}
                            </header>
                            <button
                              className="property-image-slot-preview"
                              onClick={() => openSlotEditor(slotIndex)}
                              type="button"
                            >
                              {asset?.delivery_url ? (
                                <img
                                  alt={`Property slot ${slotIndex + 1}`}
                                  src={
                                    resolveUrl(
                                      asset,
                                      "https://placehold.co/980x1280/0d1117/e6ecf3?text=Property"
                                    ) ?? "https://placehold.co/980x1280/0d1117/e6ecf3?text=Property"
                                  }
                                />
                              ) : (
                                <span>{canUpload ? "Tap to upload" : "Upload earlier cards first"}</span>
                              )}
                            </button>
                            <div className="property-image-slot-meta">
                              <strong>{asset?.room_category ?? "Room tag pending"}</strong>
                              <span>{asset?.caption || "Optional custom tag"}</span>
                            </div>
                            <div className="property-image-slot-actions">
                              <button className="soft-button" onClick={() => openSlotEditor(slotIndex)} type="button">
                                {asset ? "Edit" : "Add"}
                              </button>
                              <button
                                className="soft-button"
                                disabled={!asset}
                                draggable={Boolean(asset)}
                                onDragStart={() => setDraggingMediaId(asset?.id ?? null)}
                                onDragEnd={() => setDraggingMediaId(null)}
                                type="button"
                              >
                                Drag
                              </button>
                              <button
                                className="soft-button"
                                disabled={!asset}
                                onClick={() => void moveImage(asset?.id ?? "", -1)}
                                type="button"
                              >
                                Up
                              </button>
                              <button
                                className="soft-button"
                                disabled={!asset}
                                onClick={() => void moveImage(asset?.id ?? "", 1)}
                                type="button"
                              >
                                Down
                              </button>
                              <button
                                className="ghost-button"
                                disabled={!asset}
                                onClick={() => void handleDeleteMedia(asset?.id ?? "")}
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <div className="hint" style={{ marginTop: 12 }}>
                      Required cards must be filled from first slot onward before publishing.
                    </div>
                    <div className="action-row properties-step-actions">
                      <button className="ghost-button" onClick={() => setCurrentStep(2)} type="button">
                        Back
                      </button>
                      <button className="primary-button" onClick={() => void handleSaveAndPreview()} type="button">
                        {isDraftListing ? "Create and Preview" : "Update and preview"}
                      </button>
                    </div>
                    <button
                      className="properties-delete-banner"
                      onClick={() => {
                        setDeletePropertyInput("");
                        setDeletePropertyModalOpen(true);
                      }}
                      type="button"
                    >
                      Delete property permanently. This action cannot be undone.
                    </button>
                    <div className="hint" style={{ marginTop: 8 }}>
                      To confirm deletion, type: <strong>{deletePropertyName}</strong>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <section className="surface">
          <div className="empty-panel">
            Select a property from the header dropdown or create a new draft to begin.
            <div className="action-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="primary-button" onClick={() => void handleCreateDraftWorkspace()} type="button">
                Create property draft
              </button>
            </div>
          </div>
        </section>
      )}

      {slotEditor.open ? (
        <div className="properties-modal-backdrop">
          <section className="properties-modal-card">
            <header>
              <strong>
                {slotEditor.existingAssetId ? "Edit image card" : "Add image card"} #{slotEditor.slotIndex + 1}
              </strong>
              <button className="ghost-button" onClick={closeSlotEditor} type="button">
                Close
              </button>
            </header>

            <div className="field-stack">
              <div className="form-field">
                <label>Select image</label>
                <input
                  accept="image/*"
                  capture="environment"
                  className="input"
                  onChange={(event) => handleSlotFileSelect(event.target.files)}
                  type="file"
                />
              </div>

              <div
                className={`properties-crop-frame ${slotEditor.previewUrl ? "is-interactive" : ""}`}
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
                {slotEditor.previewUrl ? (
                  <img
                    alt="Crop preview"
                    src={slotEditor.previewUrl}
                    style={{
                      transform: `scale(${slotEditor.zoom})`,
                      objectPosition: `${50 + slotEditor.offsetX}% ${50 + slotEditor.offsetY}%`
                    }}
                  />
                ) : (
                  <span>Select an image to preview and crop.</span>
                )}
              </div>
              <div className="properties-crop-help-row">
                <span className="hint">
                  Drag image to position. Pinch on mobile or scroll on desktop to zoom.
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
                    value={slotEditor.zoom}
                    onChange={(event) =>
                      setSlotEditor({
                        ...slotEditor,
                        zoom: Number(event.target.value)
                      })
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
                    value={slotEditor.offsetX}
                    onChange={(event) =>
                      setSlotEditor({
                        ...slotEditor,
                        offsetX: Number(event.target.value)
                      })
                    }
                  />
                </div>
              </div>

              <div className="field-grid">
                <div className="form-field">
                  <label>Vertical position</label>
                  <input
                    className="input"
                    max={40}
                    min={-40}
                    step={1}
                    type="range"
                    value={slotEditor.offsetY}
                    onChange={(event) =>
                      setSlotEditor({
                        ...slotEditor,
                        offsetY: Number(event.target.value)
                      })
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Room tag</label>
                  <select
                    className="select"
                    value={slotEditor.roomCategory}
                    onChange={(event) =>
                      setSlotEditor({
                        ...slotEditor,
                        roomCategory: event.target.value
                      })
                    }
                  >
                    {roomOptions.map((option, index) => (
                      <option key={`${option.value}-${index}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Optional custom name (max {MAX_TAG_LENGTH})</label>
                <input
                  className="input"
                  maxLength={MAX_TAG_LENGTH}
                  placeholder="Example: Bedroom sunlight corner"
                  value={slotEditor.caption}
                  onChange={(event) =>
                    setSlotEditor({
                      ...slotEditor,
                      caption: event.target.value.slice(0, MAX_TAG_LENGTH)
                    })
                  }
                />
              </div>
            </div>

            <footer className="action-row" style={{ marginTop: 16 }}>
              <button className="ghost-button" onClick={closeSlotEditor} type="button">
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={slotEditor.busy}
                onClick={() => void handleSaveSlotEditor()}
                type="button"
              >
                {slotEditor.busy ? "Saving..." : "Save image"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {deletePropertyModalOpen ? (
        <div className="properties-modal-backdrop">
          <section className="properties-upgrade-card properties-delete-modal-card">
            <h3>Delete Property</h3>
            <p>
              This will permanently delete the property listing and related listing visibility.
              Type <strong>{deletePropertyName}</strong> to continue.
            </p>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Confirm property name</label>
              <input
                className="input"
                value={deletePropertyInput}
                onChange={(event) => setDeletePropertyInput(event.target.value)}
              />
            </div>
            <div className="action-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button
                className="ghost-button"
                onClick={() => {
                  setDeletePropertyModalOpen(false);
                  setDeletePropertyInput("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button className="danger-button" onClick={() => void handleDeletePropertyConfirmed()} type="button">
                Delete
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {upgradeModalOpen ? (
        <div className="properties-modal-backdrop">
          <section className="properties-upgrade-card">
            <h3>Upgrade to premium</h3>
            <p>
              {upgradeReason} is available on premium plan. You can continue managing listing basics,
              or upgrade now to unlock this control.
            </p>
            <div className="action-row">
              <button className="ghost-button" onClick={() => setUpgradeModalOpen(false)} type="button">
                Close
              </button>
              <Link className="primary-button" href="/plan">
                View upgrade plans
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
