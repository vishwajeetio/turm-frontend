"use client";

import type { ReactNode, SetStateAction } from "react";

import {
  PropertyFeedCard,
  type PropertyFeedCardMediaSlide,
  type PropertyFeedCardStatItem,
} from "@/components/property-feed-card";
import {
  TenantFeedCard,
  type TenantFeedCardSection,
  type TenantFeedCardStatItem,
} from "@/components/tenant-feed-card";

type ListingPreviewProps = {
  kind: "LISTING";
  headline: string;
  localityLine: string;
  chips: string[];
  score?: { value: string; label: string };
  stats?: PropertyFeedCardStatItem[];
  reasons: string[];
  fallbackReason: string;
  media: PropertyFeedCardMediaSlide[];
  activeImageIndex: number;
  onImageIndexChange: (next: SetStateAction<number>) => void;
  mobileDetailsExpanded: boolean;
  onMobileDetailsExpandedChange: (next: boolean) => void;
  floatingActions?: ReactNode;
  detailsFooter?: ReactNode;
};

type TenantPreviewProps = {
  kind: "TENANT";
  avatarSrc: string;
  avatarAlt: string;
  headline: string;
  subheadline: string;
  chips: string[];
  score?: { value: string; label: string };
  stats?: TenantFeedCardStatItem[];
  sections: TenantFeedCardSection[];
  mobileDetailsExpanded: boolean;
  onMobileDetailsExpandedChange: (next: boolean) => void;
  floatingActions?: ReactNode;
  detailsFooter?: ReactNode;
};

export function InteractionPreviewModal({
  title,
  subtitle,
  preview,
  onClose,
}: {
  title: string;
  subtitle?: string;
  preview: ListingPreviewProps | TenantPreviewProps;
  onClose: () => void;
}) {
  return (
    <div className="preview-modal-backdrop" onClick={onClose}>
      <div className="preview-modal-shell" onClick={(event) => event.stopPropagation()}>
        <header className="preview-modal-header">
          <div>
            <strong>{title}</strong>
            {subtitle ? <p className="section-copy" style={{ marginTop: 6 }}>{subtitle}</p> : null}
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className="preview-modal-body">
          {preview.kind === "LISTING" ? (
            <PropertyFeedCard
              activeImageIndex={preview.activeImageIndex}
              chips={preview.chips}
              detailsFooter={preview.detailsFooter}
              fallbackReason={preview.fallbackReason}
              floatingActions={preview.floatingActions}
              headline={preview.headline}
              localityLine={preview.localityLine}
              media={preview.media}
              mobileDetailsExpanded={preview.mobileDetailsExpanded}
              onImageIndexChange={preview.onImageIndexChange}
              onMobileDetailsExpandedChange={preview.onMobileDetailsExpandedChange}
              reasons={preview.reasons}
              score={preview.score}
              stats={preview.stats}
            />
          ) : (
            <TenantFeedCard
              avatarAlt={preview.avatarAlt}
              avatarSrc={preview.avatarSrc}
              chips={preview.chips}
              detailsFooter={preview.detailsFooter}
              floatingActions={preview.floatingActions}
              headline={preview.headline}
              mobileDetailsExpanded={preview.mobileDetailsExpanded}
              onMobileDetailsExpandedChange={preview.onMobileDetailsExpandedChange}
              score={preview.score}
              sections={preview.sections}
              stats={preview.stats}
              subheadline={preview.subheadline}
            />
          )}
        </div>
      </div>
    </div>
  );
}
