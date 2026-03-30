"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AppShell } from "@/components/app-shell";
import { InteractionPreviewModal } from "@/components/interaction-preview-modal";
import { useAuth } from "@/components/providers/auth-provider";
import {
  approveMatchVisit,
  blockMatchCounterpart,
  getListingFullMedia,
  getMatchThread,
  listConversations,
  reportMatchCounterpart,
  sendMessage,
  shareMatchAddress,
  shareMatchContact,
} from "@/lib/api";
import type {
  ConversationPreviewResponse,
  FeedCardMedia,
  MatchThreadResponse,
} from "@/lib/types";
import { useSecureMediaCache, type SecureMediaAssetLike } from "@/lib/use-secure-media-cache";
import { formatCurrency, formatDate } from "@/lib/utils";

type PreviewMode = "listing" | "tenant" | null;
type ThreadActionKind =
  | "share-contact"
  | "share-address"
  | "approve-visit"
  | "block"
  | "report";
type ResolveMediaUrl = (
  asset: SecureMediaAssetLike | null | undefined,
  fallback?: string | null
) => string | null;

const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "safety", label: "Safety concern" },
  { value: "abuse", label: "Abusive behavior" },
  { value: "fake_listing", label: "Fake or misleading" },
];

function buildListingSlides(
  thread: MatchThreadResponse,
  media: FeedCardMedia[],
  resolveMediaUrl: ResolveMediaUrl
) {
  if (media.length) {
    return media.map((asset, index) => ({
      id: asset.media_asset_id,
      src:
        resolveMediaUrl(asset, "https://placehold.co/900x1200/09110f/f3fffb?text=Property") ??
        "https://placehold.co/900x1200/09110f/f3fffb?text=Property",
      alt: `${thread.listing.headline} image ${index + 1}`,
      roomTag: asset.room_category ?? null,
      customTag: asset.caption ?? null,
    }));
  }
  return [
    {
      id: thread.listing.cover_image?.media_asset_id ?? "cover",
      src:
        resolveMediaUrl(
          thread.listing.cover_image,
          "https://placehold.co/900x1200/09110f/f3fffb?text=Property"
        ) ??
        "https://placehold.co/900x1200/09110f/f3fffb?text=Property",
      alt: thread.listing.headline,
    },
  ];
}

function formatMessageTimestamp(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getMessageReceiptLabel(message: MatchThreadResponse["messages"][number]) {
  if (!message.is_mine) {
    return null;
  }
  if (message.read_at) {
    return `Read ${formatMessageTimestamp(message.read_at)}`;
  }
  if (message.delivered_at) {
    return "Delivered";
  }
  return "Sent";
}

function isNotificationApiAvailable() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function MessagesScreen() {
  const { dashboard, loading, session } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreviewResponse[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [thread, setThread] = useState<MatchThreadResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(null);
  const [previewMedia, setPreviewMedia] = useState<FeedCardMedia[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewMobileExpanded, setPreviewMobileExpanded] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [matchedContextOpen, setMatchedContextOpen] = useState(false);
  const [threadAction, setThreadAction] = useState<ThreadActionKind | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [visitMode, setVisitMode] = useState("In person");
  const [visitStartAt, setVisitStartAt] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [reportReason, setReportReason] = useState("safety");
  const [reportDescription, setReportDescription] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  const { queuePrefetch, queuePrefetchMany, resolveUrl } = useSecureMediaCache({ concurrency: 4 });

  const threadMenuRef = useRef<HTMLDivElement | null>(null);
  const previewSlides = useMemo(
    () => (thread ? buildListingSlides(thread, previewMedia, resolveUrl) : []),
    [previewMedia, resolveUrl, thread]
  );
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.match_id === activeMatchId) ?? null,
    [activeMatchId, conversations]
  );

  async function refreshConversations(preferredMatchId?: string | null) {
    if (!session) {
      return;
    }
    const items = await listConversations(session);
    setConversations(items);
    setActiveMatchId((current) => {
      const requestedMatchId =
        preferredMatchId !== undefined ? preferredMatchId : current;
      if (requestedMatchId && items.some((item) => item.match_id === requestedMatchId)) {
        return requestedMatchId;
      }
      if (isMobileView) {
        return null;
      }
      return items[0]?.match_id ?? null;
    });
    if (preferredMatchId !== undefined && !items.some((item) => item.match_id === preferredMatchId)) {
      setThread(null);
    }
  }

  async function loadThread(matchId: string) {
    if (!session) {
      return;
    }
    const response = await getMatchThread(session, matchId);
    setThread(response);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 1180px)");
    const syncViewport = () => setIsMobileView(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    refreshConversations().catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Unable to load conversations")
    );
  }, [isMobileView, session]);

  useEffect(() => {
    if (!session || !activeMatchId) {
      if (isMobileView) {
        setThread(null);
      }
      return;
    }
    loadThread(activeMatchId).catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Unable to load thread")
    );
  }, [activeMatchId, isMobileView, session]);

  useEffect(() => {
    setMatchedContextOpen(false);
  }, [activeMatchId, isMobileView]);

  useEffect(() => {
    if (!isNotificationApiAvailable()) {
      return;
    }
    setNotificationPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
    if (!threadMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (threadMenuRef.current && !threadMenuRef.current.contains(event.target as Node)) {
        setThreadMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThreadMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [threadMenuOpen]);

  useEffect(() => {
    if (!thread) {
      return;
    }
    if (thread.listing.cover_image) {
      queuePrefetch(thread.listing.cover_image, 260);
    }
    if (thread.tenant_preview?.profile_image) {
      queuePrefetch(thread.tenant_preview.profile_image, 240);
    }
  }, [queuePrefetch, thread]);

  useEffect(() => {
    if (previewMode !== "listing" || !previewMedia.length) {
      return;
    }
    const currentChunkStart = Math.floor(previewImageIndex / 6) * 6;
    queuePrefetchMany(previewMedia.slice(currentChunkStart, currentChunkStart + 6), 340);
    queuePrefetchMany(previewMedia.slice(currentChunkStart + 6, currentChunkStart + 12), 200);
  }, [previewImageIndex, previewMedia, previewMode, queuePrefetchMany]);

  async function requestNotificationPermission() {
    if (!isNotificationApiAvailable()) {
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
  }

  async function openListingPreview() {
    if (!session || !thread) {
      return;
    }
    setMatchedContextOpen(false);
    setPreviewMode("listing");
    setPreviewImageIndex(0);
    setPreviewMobileExpanded(false);
    setPreviewMedia([]);
    setPreviewLoading(true);
    try {
      const media = await getListingFullMedia(session, thread.listing.listing_id);
      setPreviewMedia(media);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load property preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  function openTenantPreview() {
    setMatchedContextOpen(false);
    setPreviewMode("tenant");
    setPreviewMobileExpanded(false);
  }

  function openThreadAction(kind: ThreadActionKind) {
    setThreadMenuOpen(false);
    setMatchedContextOpen(false);
    setThreadAction(kind);
    setActionBusy(false);
    setActionNote("");
    setVisitMode("In person");
    setVisitStartAt("");
    setMeetingPoint("");
    setReportReason("safety");
    setReportDescription("");
  }

  async function submitThreadAction(event: FormEvent) {
    event.preventDefault();
    if (!session || !threadAction || !thread) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      if (threadAction === "share-contact") {
        await shareMatchContact(session, thread.match.match_id, {
          note: actionNote.trim() || undefined,
        });
      } else if (threadAction === "share-address") {
        await shareMatchAddress(session, thread.match.match_id, {
          note: actionNote.trim() || undefined,
        });
      } else if (threadAction === "approve-visit") {
        await approveMatchVisit(session, thread.match.match_id, {
          scheduled_start_at: visitStartAt ? new Date(visitStartAt).toISOString() : null,
          visit_mode: visitMode.trim() || null,
          meeting_point: meetingPoint.trim() || null,
          owner_notes: actionNote.trim() || null,
        });
      } else if (threadAction === "block") {
        await blockMatchCounterpart(session, thread.match.match_id, {
          reason: actionNote.trim() || undefined,
        });
        setThreadAction(null);
        setDraft("");
        await refreshConversations(null);
        setActiveMatchId(null);
        setThread(null);
        return;
      } else if (threadAction === "report") {
        await reportMatchCounterpart(session, thread.match.match_id, {
          reason_code: reportReason,
          description: reportDescription.trim() || undefined,
        });
      }
      setThreadAction(null);
      await refreshConversations(thread.match.match_id);
      await loadThread(thread.match.match_id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update this thread");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!session || !thread || !dashboard?.user.id || !draft.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendMessage(session, thread.match.match_id, {
        sender_user_id: dashboard.user.id,
        text_body: draft.trim(),
      });
      await Promise.all([
        refreshConversations(thread.match.match_id),
        loadThread(thread.match.match_id),
      ]);
      setDraft("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send message");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Messages"
        eyebrow="Syncing"
        description="Loading matches, conversations, and property context."
      >
        <div className="empty-panel">Loading messages...</div>
      </AppShell>
    );
  }

  if (!session || !dashboard) {
    return null;
  }

  const threadPanel = thread ? (
    <section className={`chat-thread ${isMobileView ? "messages-thread-overlay" : ""}`}>
      <div className="thread-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <strong>{thread.counterpart_name}</strong>
            <p className="section-copy" style={{ marginTop: 8 }}>
              {thread.listing.headline}
            </p>
          </div>
          <div className="messages-thread-header-tools">
            <div className="inline-meta">
              <span className="mini-chip">{formatCurrency(thread.listing.monthly_rent_inr)}</span>
              <span className="mini-chip">{thread.listing.bhk} BHK</span>
              <span className="mini-chip">{thread.listing.city}</span>
            </div>
            <div className="messages-thread-action-row">
              {isMobileView ? (
                <button
                  className="ghost-button"
                  onClick={() => {
                    setActiveMatchId(null);
                    setThread(null);
                  }}
                  type="button"
                >
                  Back
                </button>
              ) : null}
              <button
                className="ultra-feed-icon-button ultra-feed-header-action-button"
                onClick={() => {
                  setThreadMenuOpen(false);
                  setMatchedContextOpen(true);
                }}
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
                  <path
                    d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm0 4.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm1.25 9.5h-2.5v-1.5h.5V12h-1V10.5h2.5v4.75h.5z"
                    fill="currentColor"
                  />
                </svg>
                <span className="ultra-feed-action-label">Context</span>
              </button>
              <div className="messages-thread-menu-shell" ref={threadMenuRef}>
              <button
                className="ultra-feed-icon-button"
                onClick={() => setThreadMenuOpen((current) => !current)}
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
                  <path
                    d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div className={`ultra-feed-corner-menu messages-thread-menu ${threadMenuOpen ? "is-open" : ""}`}>
                <div className="ultra-feed-corner-menu-section">
                  <span className="ultra-feed-menu-title">Thread actions</span>
                  <nav>
                    {thread.can_share_contact ? (
                      <button onClick={() => openThreadAction("share-contact")} type="button">
                        Share contact
                      </button>
                    ) : null}
                    {thread.can_share_listing_address ? (
                      <button onClick={() => openThreadAction("share-address")} type="button">
                        Share address
                      </button>
                    ) : null}
                    {thread.can_approve_visit ? (
                      <button onClick={() => openThreadAction("approve-visit")} type="button">
                        Approve visit
                      </button>
                    ) : null}
                    <button onClick={() => openThreadAction("block")} type="button">
                      Block user
                    </button>
                    <button onClick={() => openThreadAction("report")} type="button">
                      Report user
                    </button>
                  </nav>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {notificationPermission === "default" ? (
          <div className="messages-notification-banner">
            <div>
              <strong>Turn on message alerts</strong>
              <p className="section-copy" style={{ marginTop: 6 }}>
                Allow notifications so new matches and replies reach you instantly.
              </p>
            </div>
            <button className="soft-button" onClick={() => void requestNotificationPermission()} type="button">
              Enable
            </button>
          </div>
        ) : null}
      </div>

      <div className="message-list">
        {thread.messages.length ? (
          thread.messages.map((message) => (
            <article
              className={`message-bubble ${message.is_mine ? "is-mine" : ""} ${
                message.message_type === "SYSTEM" ? "is-system" : ""
              }`}
              key={message.id}
            >
              <strong>{message.message_type === "SYSTEM" ? "Update" : message.sender_name}</strong>
              <p className="section-copy" style={{ marginTop: 8 }}>
                {message.text_body}
              </p>
              <div className="messages-message-meta">
                <span className="hint">{formatMessageTimestamp(message.created_at)}</span>
                {getMessageReceiptLabel(message) ? (
                  <span className="hint">{getMessageReceiptLabel(message)}</span>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-panel">No messages yet. Break the ice from here.</div>
        )}
      </div>

      <form className="thread-composer" onSubmit={handleSendMessage}>
        <div className="field-stack">
          <textarea
            className="textarea"
            placeholder="Message about rent, move-in, visits, or charges..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="action-row">
            <button className="primary-button" disabled={busy || !draft.trim()} type="submit">
              {busy ? "Sending..." : "Send message"}
            </button>
          </div>
        </div>
      </form>
    </section>
  ) : (
    <div className="empty-panel">
      {isMobileView ? "Pick a conversation to open the thread overlay." : "Pick a conversation to see the full property-linked thread."}
    </div>
  );

  return (
    <AppShell
      title="Messages"
      eyebrow="Mutual-like chat"
      description="Every conversation stays anchored to the matched listing, with the same preview model available from chat."
    >
      {error ? (
        <div className="surface">
          <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div>
        </div>
      ) : null}

      <div className={`messages-screen-shell ${isMobileView && activeConversation ? "is-thread-open" : ""}`}>
      <div className="messages-layout">
        <section className="surface list-panel">
          <div className="page-header" style={{ marginBottom: 6 }}>
            <div>
              <strong>Active conversations</strong>
              <p className="section-copy" style={{ marginTop: 8 }}>
                Open a thread to continue the matched conversation and preview the linked card.
              </p>
            </div>
          </div>
          {conversations.length ? (
            conversations.map((conversation) => (
              <button
                className={`conversation-row ${
                  activeMatchId === conversation.match_id ? "is-active" : ""
                }`}
                key={conversation.conversation_id}
                onClick={() => setActiveMatchId(conversation.match_id)}
                type="button"
              >
                <div className="messages-thread-row-head">
                  <strong>{conversation.counterpart_name}</strong>
                  {conversation.unread_count > 0 ? (
                    <span className="message-unread-badge">{conversation.unread_count}</span>
                  ) : null}
                </div>
                <p className="hint" style={{ marginTop: 6 }}>
                  {conversation.headline}
                </p>
                <div className="inline-meta" style={{ marginTop: 10 }}>
                  <span className="mini-chip">{conversation.city}</span>
                  <span className="mini-chip">{conversation.counterpart_role.toLowerCase()}</span>
                  {conversation.last_message_at ? (
                    <span className="mini-chip">{formatMessageTimestamp(conversation.last_message_at)}</span>
                  ) : null}
                </div>
              </button>
            ))
          ) : (
            <div className="empty-panel">No chats yet. Mutual likes land here automatically.</div>
          )}
        </section>

        {!isMobileView ? threadPanel : null}
      </div>

      {isMobileView && activeConversation ? (
        <div className="messages-mobile-overlay">{threadPanel}</div>
      ) : null}
      </div>

      {matchedContextOpen && thread ? (
        <div className="properties-modal-backdrop" onClick={() => setMatchedContextOpen(false)}>
          <section
            className="properties-modal-card messages-context-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>Matched context</strong>
                <p className="section-copy" style={{ marginTop: 6 }}>
                  {thread.listing.locality ? `${thread.listing.locality}, ` : ""}
                  {thread.listing.city} · Available {formatDate(thread.listing.available_from)}
                </p>
              </div>
              <button
                className="ghost-button"
                onClick={() => setMatchedContextOpen(false)}
                type="button"
              >
                Minimize
              </button>
            </header>
            <div className="messages-context-panel">
              <div className="action-row">
                <button className="soft-button" onClick={() => void openListingPreview()} type="button">
                  View property
                </button>
                {thread.tenant_preview ? (
                  <button className="soft-button" onClick={openTenantPreview} type="button">
                    View tenant
                  </button>
                ) : null}
              </div>
              <div className="messages-context-grid">
                <article>
                  <span>Visit</span>
                  <strong>{thread.visit_status ? thread.visit_status.replaceAll("_", " ") : "Not approved yet"}</strong>
                </article>
                <article>
                  <span>Address</span>
                  <strong>{thread.shared_listing_address ?? "Locked until shared"}</strong>
                </article>
                <article>
                  <span>Contact</span>
                  <strong>
                    {thread.shared_contact_phone
                      ? `${thread.shared_contact_name ?? thread.counterpart_name} · ${thread.shared_contact_phone}`
                      : "Locked until shared"}
                  </strong>
                </article>
              </div>
              {thread.shared_contact_email ? (
                <div className="hint">Email: {thread.shared_contact_email}</div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {thread && previewMode === "listing" ? (
        <InteractionPreviewModal
          onClose={() => setPreviewMode(null)}
          preview={{
            kind: "LISTING",
            headline: thread.listing.headline,
            localityLine: `${thread.listing.locality ? `${thread.listing.locality}, ` : ""}${thread.listing.city}, ${thread.listing.state}`,
            chips: [
              thread.counterpart_name,
              thread.counterpart_role.toLowerCase(),
              thread.listing.visibility_mode.toLowerCase(),
            ],
            score: {
              value: formatCurrency(thread.listing.monthly_rent_inr),
              label: "monthly rent",
            },
            stats: [
              { label: "Deposit", value: formatCurrency(thread.listing.security_deposit_inr) },
              { label: "BHK", value: `${thread.listing.bhk}` },
            ],
            reasons: [
              "This is the same listing linked to your active conversation.",
              "All property images load outside the feed window so chat previews stay independent.",
            ],
            fallbackReason: "Matched listing preview",
            media: previewSlides,
            activeImageIndex: previewImageIndex,
            onImageIndexChange: setPreviewImageIndex,
            mobileDetailsExpanded: previewMobileExpanded,
            onMobileDetailsExpandedChange: setPreviewMobileExpanded,
            detailsFooter: previewLoading ? (
              <div className="hint">Loading all property images...</div>
            ) : undefined,
          }}
          subtitle="Matched property"
          title={thread.listing.headline}
        />
      ) : null}

      {thread?.tenant_preview && previewMode === "tenant" ? (
        <InteractionPreviewModal
          onClose={() => setPreviewMode(null)}
          preview={{
            kind: "TENANT",
            avatarAlt: thread.tenant_preview.full_name,
            avatarSrc:
              resolveUrl(
                thread.tenant_preview.profile_image,
                "https://placehold.co/900x1200/09110f/f3fffb?text=Tenant"
              ) ??
              "https://placehold.co/900x1200/09110f/f3fffb?text=Tenant",
            headline: thread.tenant_preview.full_name,
            subheadline: [
              thread.tenant_preview.occupation,
              thread.tenant_preview.employer_name,
            ]
              .filter((value) => Boolean(value && value.trim().length))
              .join(" · "),
            chips: [
              thread.listing.headline,
              thread.listing.locality ? `${thread.listing.locality}, ${thread.listing.city}` : thread.listing.city,
              "Matched tenant",
            ],
            score: {
              value: "Matched",
              label: "tenant",
            },
            stats: [
              { label: "Completion", value: `${thread.tenant_preview.completion_score}%` },
              {
                label: "Residents",
                value: String(thread.tenant_preview.family_size ?? 1),
              },
            ],
            sections: [
              {
                title: "Preferences",
                items: [
                  `Preferred localities: ${thread.tenant_preview.preferred_localities.join(", ") || "Flexible"}`,
                  `Languages: ${thread.tenant_preview.languages.join(", ") || "Not specified"}`,
                  `Food: ${thread.tenant_preview.food_preference?.replaceAll("_", " ").toLowerCase() ?? "Not specified"}`,
                ],
              },
              ...(thread.tenant_preview.about_lifestyle
                ? [
                    {
                      title: "About lifestyle",
                      body: thread.tenant_preview.about_lifestyle,
                    },
                  ]
                : []),
            ],
            mobileDetailsExpanded: previewMobileExpanded,
            onMobileDetailsExpandedChange: setPreviewMobileExpanded,
          }}
          subtitle="Matched tenant"
          title={thread.tenant_preview.full_name}
        />
      ) : null}

      {threadAction ? (
        <div className="properties-modal-backdrop" onClick={() => setThreadAction(null)}>
          <form
            className="properties-modal-card messages-action-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitThreadAction}
          >
            <header>
              <div>
                <strong>
                  {threadAction === "share-contact"
                    ? "Share contact"
                    : threadAction === "share-address"
                      ? "Share address"
                      : threadAction === "approve-visit"
                        ? "Approve visit"
                        : threadAction === "block"
                          ? "Block user"
                          : "Report user"}
                </strong>
                <p className="section-copy" style={{ marginTop: 6 }}>
                  {threadAction === "share-contact"
                    ? "Your contact details will become visible in this conversation."
                    : threadAction === "share-address"
                      ? "This reveals the exact listing address to the tenant."
                      : threadAction === "approve-visit"
                        ? "Confirm the visit and unlock the listing address in chat."
                        : threadAction === "block"
                          ? "Blocking removes this user from feed, likes, and messages."
                          : "Reports are stored for moderation review."}
                </p>
              </div>
              <button className="ghost-button" onClick={() => setThreadAction(null)} type="button">
                Cancel
              </button>
            </header>

            <div className="field-stack">
              {threadAction === "approve-visit" ? (
                <>
                  <div className="field-grid">
                    <div className="form-field">
                      <label htmlFor="visit-start">Visit time</label>
                      <input
                        className="input"
                        id="visit-start"
                        type="datetime-local"
                        value={visitStartAt}
                        onChange={(event) => setVisitStartAt(event.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="visit-mode">Visit mode</label>
                      <input
                        className="input"
                        id="visit-mode"
                        value={visitMode}
                        onChange={(event) => setVisitMode(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="meeting-point">Meeting point</label>
                    <input
                      className="input"
                      id="meeting-point"
                      value={meetingPoint}
                      onChange={(event) => setMeetingPoint(event.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {threadAction === "report" ? (
                <>
                  <div className="form-field">
                    <label htmlFor="report-reason">Reason</label>
                    <select
                      className="select"
                      id="report-reason"
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                    >
                      {REPORT_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="report-description">Details</label>
                    <textarea
                      className="textarea"
                      id="report-description"
                      value={reportDescription}
                      onChange={(event) => setReportDescription(event.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="form-field">
                  <label htmlFor="thread-action-note">
                    {threadAction === "block" ? "Reason" : "Optional note"}
                  </label>
                  <textarea
                    className="textarea"
                    id="thread-action-note"
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                  />
                </div>
              )}

              <div className="action-row">
                <button className="primary-button" disabled={actionBusy} type="submit">
                  {actionBusy ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
