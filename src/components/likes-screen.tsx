"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { InteractionPreviewModal } from "@/components/interaction-preview-modal";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getLikes,
  getListingFullMedia,
  swipeListing,
  swipeTenant,
} from "@/lib/api";
import type {
  FeedCardMedia,
  LikeListItemResponse,
  LikesOverviewResponse,
} from "@/lib/types";
import { useSecureMediaCache, type SecureMediaAssetLike } from "@/lib/use-secure-media-cache";
import { formatDate } from "@/lib/utils";

type LikesTab = "sent" | "received";
type ResolveMediaUrl = (
  asset: SecureMediaAssetLike | null | undefined,
  fallback?: string | null
) => string | null;

function formatCurrency(value: number | null | undefined) {
  if (!value) {
    return "Flexible";
  }
  return `Rs ${value.toLocaleString("en-IN")}`;
}

function getLikePreviewAsset(item: LikeListItemResponse): SecureMediaAssetLike | null {
  return item.cover_image ?? item.tenant_preview?.profile_image ?? null;
}

function buildListingSlides(
  item: LikeListItemResponse,
  media: FeedCardMedia[],
  resolveMediaUrl: ResolveMediaUrl
) {
  if (media.length) {
    return media.map((asset, index) => ({
      id: asset.media_asset_id,
      src:
        resolveMediaUrl(asset, "https://placehold.co/900x1200/09110f/f3fffb?text=Property") ??
        "https://placehold.co/900x1200/09110f/f3fffb?text=Property",
      alt: `${item.headline} image ${index + 1}`,
      roomTag: asset.room_category ?? null,
      customTag: asset.caption ?? null,
    }));
  }
  return [
    {
      id: item.cover_image?.media_asset_id ?? `${item.like_id}-cover`,
      src:
        resolveMediaUrl(
          item.cover_image,
          "https://placehold.co/900x1200/09110f/f3fffb?text=Property"
        ) ??
        "https://placehold.co/900x1200/09110f/f3fffb?text=Property",
      alt: item.headline,
    },
  ];
}

function buildTenantSections(item: LikeListItemResponse): Array<{
  title: string;
  items?: string[];
  body?: string;
}> {
  const preview = item.tenant_preview;
  if (!preview) {
    return [
      {
        title: "Activity",
        items: [
          `${item.counterpart_name} liked this listing.`,
          `Conversation opens after the like is returned.`,
        ],
      },
    ];
  }
  return [
    {
      title: "Preferences",
      items: [
        `Preferred localities: ${preview.preferred_localities.join(", ") || "Flexible"}`,
        `Languages: ${preview.languages.join(", ") || "Not specified"}`,
        `Food: ${preview.food_preference?.replaceAll("_", " ").toLowerCase() ?? "Not specified"}`,
        `Smoking: ${preview.smoking_preference?.replaceAll("_", " ").toLowerCase() ?? "Not specified"}`,
      ],
    },
    ...(preview.about_lifestyle
      ? [
          {
            title: "About lifestyle",
            body: preview.about_lifestyle,
          },
        ]
      : []),
  ];
}

function LikesGridCard({
  item,
  imageSrc,
  onOpen,
}: {
  item: LikeListItemResponse;
  imageSrc: string;
  onOpen: () => void;
}) {
  return (
    <button className="likes-grid-card" onClick={onOpen} type="button">
      <div className="likes-grid-card-media">
        <img
          alt={item.counterpart_name}
          src={imageSrc}
        />
      </div>
      <div className="likes-grid-card-body">
        <strong>{item.counterpart_name}</strong>
        <p>{item.headline}</p>
        <div className="inline-meta" style={{ marginTop: 10 }}>
          <span className="mini-chip">{item.counterpart_role.toLowerCase()}</span>
          <span className="mini-chip">{item.city}</span>
        </div>
      </div>
    </button>
  );
}

export function LikesScreen() {
  const { dashboard, loading, session } = useAuth();
  const [likes, setLikes] = useState<LikesOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LikesTab>("sent");
  const [previewItem, setPreviewItem] = useState<LikeListItemResponse | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewMobileExpanded, setPreviewMobileExpanded] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<FeedCardMedia[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { queuePrefetch, queuePrefetchMany, resolveUrl } = useSecureMediaCache({ concurrency: 4 });

  const isPremium = dashboard?.active_subscription.plan_code === "PREMIUM";
  const previewSlides = useMemo(
    () => (previewItem ? buildListingSlides(previewItem, previewMedia, resolveUrl) : []),
    [previewItem, previewMedia, resolveUrl]
  );

  async function refreshLikes() {
    if (!session) {
      return;
    }
    const response = await getLikes(session);
    setLikes(response);
  }

  useEffect(() => {
    if (!session) {
      return;
    }
    refreshLikes().catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Unable to load likes")
    );
  }, [session]);

  async function openPreview(item: LikeListItemResponse) {
    setPreviewItem(item);
    setPreviewImageIndex(0);
    setPreviewMobileExpanded(false);
    setPreviewMedia([]);
    if (!session || item.preview_kind !== "LISTING") {
      return;
    }
    setPreviewLoading(true);
    try {
      const media = await getListingFullMedia(session, item.listing_id);
      setPreviewMedia(media);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load preview media");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRespondToReceivedLike(action: "LIKE" | "PASS") {
    if (!session || !dashboard || !previewItem) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      if (previewItem.preview_kind === "LISTING") {
        if (!dashboard.tenant_profile?.id) {
          throw new Error("Complete your tenant profile before responding to property likes.");
        }
        await swipeListing(session, {
          tenant_profile_id: dashboard.tenant_profile.id,
          tenant_user_id: dashboard.user.id,
          listing_id: previewItem.listing_id,
          action,
          source_session_id: `likes-${Date.now()}`,
        });
      } else {
        await swipeTenant(session, {
          listing_id: previewItem.listing_id,
          tenant_profile_id: previewItem.tenant_profile_id,
          acted_by_user_id: dashboard.user.id,
          action,
          source_session_id: `likes-${Date.now()}`,
        });
      }
      await refreshLikes();
      setPreviewItem(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to respond to like");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Likes" eyebrow="Syncing" description="Loading sent and received interest.">
        <div className="empty-panel">Loading likes...</div>
      </AppShell>
    );
  }

  if (!session || !dashboard) {
    return null;
  }

  const items = activeTab === "sent" ? likes?.sent ?? [] : likes?.received ?? [];

  useEffect(() => {
    items.forEach((item, index) => {
      const asset = getLikePreviewAsset(item);
      if (asset) {
        queuePrefetch(asset, 240 - index);
      }
    });
  }, [items, queuePrefetch]);

  useEffect(() => {
    if (!previewItem || previewItem.preview_kind !== "LISTING" || !previewMedia.length) {
      return;
    }
    const currentChunkStart = Math.floor(previewImageIndex / 6) * 6;
    queuePrefetchMany(previewMedia.slice(currentChunkStart, currentChunkStart + 6), 320);
    queuePrefetchMany(previewMedia.slice(currentChunkStart + 6, currentChunkStart + 12), 180);
  }, [previewImageIndex, previewItem, previewMedia, queuePrefetchMany]);

  return (
    <AppShell
      title="Likes"
      eyebrow="Signals"
      description="Review outbound interest, received interest, and jump into the same preview model used in feed."
      actions={
        <div className="inline-meta">
          <span className="mini-chip">{dashboard.active_subscription.plan_name}</span>
        </div>
      }
    >
      {error ? (
        <div className="surface">
          <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div>
        </div>
      ) : null}

      <section className="surface">
        <div className="likes-tab-row">
          <button
            className={`likes-tab-button ${activeTab === "sent" ? "is-active" : ""}`}
            onClick={() => setActiveTab("sent")}
            type="button"
          >
            Likes sent
          </button>
          <button
            className={`likes-tab-button ${activeTab === "received" ? "is-active" : ""}`}
            onClick={() => {
              if (!isPremium) {
                setUpgradeOpen(true);
                return;
              }
              setActiveTab("received");
            }}
            type="button"
          >
            Likes received
          </button>
        </div>

        {items.length ? (
          <div className="likes-grid">
            {items.map((item) => (
              <LikesGridCard
                imageSrc={
                  resolveUrl(
                    getLikePreviewAsset(item),
                    "https://placehold.co/720x960/09110f/f3fffb?text=Preview"
                  ) ?? "https://placehold.co/720x960/09110f/f3fffb?text=Preview"
                }
                item={item}
                key={item.like_id}
                onOpen={() => void openPreview(item)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            {activeTab === "sent"
              ? "Likes you send will appear here."
              : "Received likes appear here after you upgrade to Pro."}
          </div>
        )}
      </section>

      {previewItem ? (
        previewItem.preview_kind === "LISTING" ? (
          <InteractionPreviewModal
            onClose={() => setPreviewItem(null)}
            preview={{
              kind: "LISTING",
              headline: previewItem.headline,
              localityLine: `${previewItem.locality ? `${previewItem.locality}, ` : ""}${previewItem.city}`,
              chips: [
                previewItem.counterpart_name,
                previewItem.counterpart_role.toLowerCase(),
                previewItem.direction.toLowerCase(),
              ],
              score: {
                value: previewItem.direction === "RECEIVED" ? "Received" : "Sent",
                label: "interest",
              },
              stats: [
                {
                  label: "Date",
                  value: formatDate(previewItem.liked_at),
                },
                {
                  label: "Chat",
                  value: previewItem.conversation_id ? "Open" : "Pending",
                },
              ],
              reasons: [
                previewItem.conversation_id
                  ? "A mutual match already exists for this listing."
                  : "Return the like to open a conversation.",
                previewLoading ? "Loading the full property media set..." : "Secure property media loaded separately from feed windows.",
              ],
              fallbackReason: "Interest stays private until both sides act.",
              media: previewSlides,
              activeImageIndex: previewImageIndex,
              onImageIndexChange: setPreviewImageIndex,
              mobileDetailsExpanded: previewMobileExpanded,
              onMobileDetailsExpandedChange: setPreviewMobileExpanded,
              floatingActions:
                previewItem.direction === "RECEIVED" ? (
                  <>
                    <button
                      className="ultra-feed-action-button ultra-feed-action-pill"
                      disabled={actionBusy}
                      onClick={() => void handleRespondToReceivedLike("PASS")}
                      type="button"
                    >
                      <span>{actionBusy ? "Working..." : "Dislike"}</span>
                    </button>
                    <button
                      className="ultra-feed-action-button ultra-feed-action-pill ultra-feed-action-pill-primary"
                      disabled={actionBusy}
                      onClick={() => void handleRespondToReceivedLike("LIKE")}
                      type="button"
                    >
                      <span>{actionBusy ? "Working..." : "Like back"}</span>
                    </button>
                  </>
                ) : previewItem.conversation_id ? (
                  <Link
                    className="ultra-feed-action-button ultra-feed-action-pill ultra-feed-action-pill-primary"
                    href="/messages"
                  >
                    <span>Open messages</span>
                  </Link>
                ) : undefined,
              detailsFooter: previewLoading ? (
                <div className="hint">Loading all property images...</div>
              ) : undefined,
            }}
            subtitle="Property preview"
            title={previewItem.counterpart_name}
          />
        ) : (
          <InteractionPreviewModal
            onClose={() => setPreviewItem(null)}
            preview={{
              kind: "TENANT",
              avatarAlt: previewItem.counterpart_name,
              avatarSrc:
                resolveUrl(
                  previewItem.tenant_preview?.profile_image ?? previewItem.cover_image,
                  "https://placehold.co/900x1200/09110f/f3fffb?text=Tenant"
                ) ??
                "https://placehold.co/900x1200/09110f/f3fffb?text=Tenant",
              headline: previewItem.tenant_preview?.full_name ?? previewItem.counterpart_name,
              subheadline: [
                previewItem.tenant_preview?.occupation,
                previewItem.tenant_preview?.employer_name,
                previewItem.city,
              ]
                .filter((value) => Boolean(value && value.trim().length))
                .join(" · "),
              chips: [
                previewItem.headline,
                previewItem.locality ? `${previewItem.locality}, ${previewItem.city}` : previewItem.city,
                `Liked ${formatDate(previewItem.liked_at)}`,
              ],
              score: {
                value: previewItem.direction === "RECEIVED" ? "Received" : "Sent",
                label: "interest",
              },
              stats: [
                {
                  label: "Completion",
                  value: `${previewItem.tenant_preview?.completion_score ?? 0}%`,
                },
                {
                  label: "Stay",
                  value: previewItem.tenant_preview?.preferred_stay_months
                    ? `${previewItem.tenant_preview.preferred_stay_months} months`
                    : "Flexible",
                },
                {
                  label: "Budget",
                  value: formatCurrency(null),
                },
                {
                  label: "Residents",
                  value: String(previewItem.tenant_preview?.family_size ?? 1),
                },
              ],
              sections: buildTenantSections(previewItem),
              mobileDetailsExpanded: previewMobileExpanded,
              onMobileDetailsExpandedChange: setPreviewMobileExpanded,
              floatingActions:
                previewItem.direction === "RECEIVED" ? (
                  <>
                    <button
                      className="ultra-feed-action-button ultra-feed-action-pill"
                      disabled={actionBusy}
                      onClick={() => void handleRespondToReceivedLike("PASS")}
                      type="button"
                    >
                      <span>{actionBusy ? "Working..." : "Dislike"}</span>
                    </button>
                    <button
                      className="ultra-feed-action-button ultra-feed-action-pill ultra-feed-action-pill-primary"
                      disabled={actionBusy}
                      onClick={() => void handleRespondToReceivedLike("LIKE")}
                      type="button"
                    >
                      <span>{actionBusy ? "Working..." : "Like back"}</span>
                    </button>
                  </>
                ) : previewItem.conversation_id ? (
                  <Link
                    className="ultra-feed-action-button ultra-feed-action-pill ultra-feed-action-pill-primary"
                    href="/messages"
                  >
                    <span>Open messages</span>
                  </Link>
                ) : undefined,
            }}
            subtitle="Tenant preview"
            title={previewItem.counterpart_name}
          />
        )
      ) : null}

      {upgradeOpen ? (
        <div className="properties-modal-backdrop" onClick={() => setUpgradeOpen(false)}>
          <div className="properties-upgrade-card" onClick={(event) => event.stopPropagation()}>
            <strong>Upgrade to Pro</strong>
            <p className="section-copy" style={{ marginTop: 10 }}>
              Received likes stay hidden on the free plan. Upgrade to Pro to see who already liked you or your listings and respond instantly.
            </p>
            <div className="action-row" style={{ marginTop: 18 }}>
              <Link className="primary-button" href="/plan">
                View plans
              </Link>
              <button className="ghost-button" onClick={() => setUpgradeOpen(false)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
