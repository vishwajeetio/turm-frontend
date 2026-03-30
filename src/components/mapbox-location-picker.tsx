"use client";

import { useEffect, useRef, useState } from "react";

import {
  reverseGeoLocation,
  searchGeoLocations,
  type StoredSession
} from "@/lib/api";
import type { GeoFeatureResponse } from "@/lib/types";

type LocationValue = {
  latitude: number | null;
  longitude: number | null;
  line1: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullAddress: string;
};

type MapboxLocationPickerProps = {
  session: StoredSession | null;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  title: string;
  description: string;
  countryCode?: string;
  radiusKm?: number | null;
  onRadiusChange?: (value: number) => void;
  radiusLabel?: string;
  exactAddressRequired?: boolean;
};

declare global {
  interface Window {
    mapboxgl?: {
      accessToken: string;
      supported: (options?: { failIfMajorPerformanceCaveat?: boolean }) => boolean;
      Map: new (options: Record<string, unknown>) => {
        addControl: (control: unknown, position?: string) => void;
        flyTo: (options: Record<string, unknown>) => void;
        on: (event: string, handler: (event: any) => void) => void;
        remove: () => void;
      };
      Marker: new (options?: Record<string, unknown>) => {
        addTo: (map: unknown) => unknown;
        remove: () => void;
        setLngLat: (lngLat: [number, number]) => unknown;
      };
      NavigationControl: new (options?: Record<string, unknown>) => unknown;
    };
    __turmMapboxLoader?: Promise<void>;
  }
}

const MAPBOX_JS_SRC = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
const MAPBOX_CSS_SRC = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
const MAPBOX_DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
const DEFAULT_CENTER: [number, number] = [72.5714, 23.0225];

function normalizeLocationValue(input: LocationValue): LocationValue {
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    line1: input.line1,
    locality: input.locality,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country || "India",
    fullAddress: input.fullAddress
  };
}

function ensureMapboxAssets(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.mapboxgl) {
    return Promise.resolve();
  }
  if (window.__turmMapboxLoader) {
    return window.__turmMapboxLoader;
  }

  window.__turmMapboxLoader = new Promise((resolve, reject) => {
    const existingCss = document.querySelector(`link[data-mapbox="css"]`);
    if (!existingCss) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = MAPBOX_CSS_SRC;
      css.setAttribute("data-mapbox", "css");
      document.head.appendChild(css);
    }

    const existingScript = document.querySelector(`script[data-mapbox="js"]`) as
      | HTMLScriptElement
      | null;
    if (existingScript) {
      if (window.mapboxgl) {
        resolve();
      } else {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Unable to load Mapbox SDK.")), {
          once: true
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = MAPBOX_JS_SRC;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-mapbox", "js");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load Mapbox SDK.")), {
      once: true
    });
    document.head.appendChild(script);
  });

  return window.__turmMapboxLoader;
}

export function MapboxLocationPicker({
  session,
  value,
  onChange,
  title,
  description,
  countryCode,
  radiusKm,
  onRadiusChange,
  radiusLabel = "Search radius (km)",
  exactAddressRequired = false
}: MapboxLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const mapRef = useRef<{
    map: {
      flyTo: (options: Record<string, unknown>) => void;
      on: (event: string, handler: (event: any) => void) => void;
      remove: () => void;
    } | null;
    marker: {
      setLngLat: (lngLat: [number, number]) => unknown;
      remove: () => void;
    } | null;
  }>({ map: null, marker: null });

  const [query, setQuery] = useState(value.fullAddress || value.locality || value.city || "");
  const [results, setResults] = useState<GeoFeatureResponse[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [isPickingPoint, setIsPickingPoint] = useState(false);

  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN?.trim() ?? "";

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [onChange, value]);

  function moveMarker(latitude: number, longitude: number, fly = true) {
    const mapState = mapRef.current;
    if (!mapState.marker || !mapState.map) {
      return;
    }
    mapState.marker.setLngLat([longitude, latitude]);
    if (fly) {
      mapState.map.flyTo({
        center: [longitude, latitude],
        zoom: 14.8,
        essential: true
      });
    }
  }

  function applyFeature(feature: GeoFeatureResponse) {
    const currentValue = valueRef.current;
    const next = normalizeLocationValue({
      latitude: feature.latitude,
      longitude: feature.longitude,
      line1: feature.name || currentValue.line1,
      locality: feature.locality ?? currentValue.locality,
      city: feature.city ?? currentValue.city,
      state: feature.state ?? currentValue.state,
      postalCode: feature.postal_code ?? currentValue.postalCode,
      country: feature.country ?? (currentValue.country || "India"),
      fullAddress: feature.full_address || currentValue.fullAddress
    });
    onChangeRef.current(next);
    setQuery(next.fullAddress || next.locality || next.city || "");
    moveMarker(feature.latitude, feature.longitude, true);
  }

  useEffect(() => {
    if (!publicToken || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;
    setMapError(null);
    setWebglUnavailable(false);

    void ensureMapboxAssets()
      .then(() => {
        if (cancelled || !window.mapboxgl || !mapContainerRef.current) {
          return;
        }
        if (!window.mapboxgl.supported({ failIfMajorPerformanceCaveat: false })) {
          setWebglUnavailable(true);
          setMapError(
            "Interactive map is unavailable on this device/browser (WebGL not supported). You can still search and save location details."
          );
          return;
        }
        window.mapboxgl.accessToken = publicToken;

        const center =
          value.latitude !== null && value.longitude !== null
            ? [value.longitude, value.latitude]
            : DEFAULT_CENTER;
        let map: InstanceType<NonNullable<typeof window.mapboxgl>["Map"]>;
        try {
          map = new window.mapboxgl.Map({
            container: mapContainerRef.current,
            style: MAPBOX_DARK_STYLE,
            center,
            zoom: value.latitude !== null && value.longitude !== null ? 14.6 : 10.8,
            failIfMajorPerformanceCaveat: false
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Unable to initialize interactive map.";
          if (message.toLowerCase().includes("webgl")) {
            setWebglUnavailable(true);
            setMapError(
              "Interactive map is unavailable on this device/browser (WebGL initialization failed). You can still search and save location details."
            );
            return;
          }
          setMapError(message);
          return;
        }

        map.addControl(new window.mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
        map.on("error", (event: { error?: { message?: string } }) => {
          const message = event.error?.message ?? "";
          if (message.toLowerCase().includes("webgl")) {
            setWebglUnavailable(true);
            setMapError(
              "Interactive map is unavailable on this device/browser (WebGL initialization failed). You can still search and save location details."
            );
            map.remove();
            mapRef.current = { map: null, marker: null };
          }
        });

        const marker = new window.mapboxgl.Marker({ color: "#25d5a7" });
        marker.setLngLat(center as [number, number]);
        marker.addTo(map);

        map.on("click", (event: { lngLat?: { lat: number; lng: number } }) => {
          if (!event.lngLat) {
            return;
          }
          const nextLatitude = event.lngLat.lat;
          const nextLongitude = event.lngLat.lng;
          moveMarker(nextLatitude, nextLongitude, false);

          const currentValue = valueRef.current;
          const fallback = normalizeLocationValue({
            ...currentValue,
            latitude: nextLatitude,
            longitude: nextLongitude
          });
          onChangeRef.current(fallback);

          if (!session) {
            return;
          }

          setIsPickingPoint(true);
          void reverseGeoLocation(session, {
            latitude: nextLatitude,
            longitude: nextLongitude
          })
            .then((feature) => {
              applyFeature(feature);
            })
            .catch(() => {
              setMapError("Location pin moved, but reverse lookup failed. You can still save coordinates.");
            })
            .finally(() => setIsPickingPoint(false));
        });

        mapRef.current = {
          map,
          marker
        };
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unable to initialize map.";
        if (message.toLowerCase().includes("webgl")) {
          setWebglUnavailable(true);
          setMapError(
            "Interactive map is unavailable on this device/browser (WebGL initialization failed). You can still search and save location details."
          );
          return;
        }
        setMapError(message);
      });

    return () => {
      cancelled = true;
      mapRef.current.marker?.remove();
      mapRef.current.map?.remove();
      mapRef.current = { map: null, marker: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicToken]);

  useEffect(() => {
    if (value.latitude === null || value.longitude === null) {
      return;
    }
    moveMarker(value.latitude, value.longitude, true);
  }, [value.latitude, value.longitude]);

  useEffect(() => {
    if (!session) {
      setResults([]);
      return;
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      setSearchBusy(true);
      void searchGeoLocations(session, {
        query: trimmedQuery,
        limit: 6,
        country_code: countryCode ?? null,
        proximity_latitude: value.latitude,
        proximity_longitude: value.longitude
      })
        .then((response) => {
          setResults(response);
        })
        .catch(() => {
          setMapError("Address search is temporarily unavailable.");
        })
        .finally(() => setSearchBusy(false));
    }, 280);

    return () => {
      window.clearTimeout(handle);
    };
  }, [countryCode, query, session, value.latitude, value.longitude]);

  const radiusInputValue = radiusKm ?? 10;
  const canRenderMap = !!publicToken && !webglUnavailable;

  return (
    <section className="mapbox-picker-surface">
      <div className="mapbox-picker-header">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <div className="mapbox-picker-search-shell">
        <input
          className="input"
          placeholder="Search by area, address, society, or landmark"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {results.length ? (
          <div className="mapbox-picker-results">
            {results.map((result) => (
              <button
                className="mapbox-picker-result-item"
                key={`${result.mapbox_id ?? result.full_address}-${result.latitude}-${result.longitude}`}
                onClick={() => {
                  applyFeature(result);
                  setResults([]);
                }}
                type="button"
              >
                <strong>{result.name}</strong>
                <span>{result.full_address}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hint">
        {exactAddressRequired
          ? "Exact address + pin are required for property listings."
          : "Only approximate locality is shown in feeds. Exact address stays private until approved sharing."}
      </div>

      {onRadiusChange ? (
        <div className="field-grid">
          <div className="form-field">
            <label>{radiusLabel}</label>
            <input
              className="input"
              inputMode="numeric"
              min={1}
              max={120}
              value={radiusInputValue}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onRadiusChange(Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 120)) : 10);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mapbox-picker-map-shell">
        {canRenderMap ? (
          <div className="mapbox-picker-map" ref={mapContainerRef} />
        ) : (
          <div className="mapbox-picker-map-fallback">
            {publicToken
              ? "Interactive map is unavailable here. Use search and manual location fields."
              : "Add `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN` to render the interactive map picker."}
          </div>
        )}
      </div>

      {searchBusy || isPickingPoint ? (
        <div className="hint">Updating location…</div>
      ) : null}
      {mapError ? <div className="hint" style={{ color: "#ffd3d8" }}>{mapError}</div> : null}
    </section>
  );
}

export type { LocationValue };
