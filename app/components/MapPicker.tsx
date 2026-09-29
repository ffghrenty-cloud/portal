"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";

type Props = {
  defaultCenter?: [number, number];
  onSelect: (data: {
    lat: number;
    lng: number;
    city: string;
    address: string;
    fullAddress: string;
    country?: string;
    region?: string;
  }) => void;
};

export default function MapPicker({
  defaultCenter = [54.5133, 30.4034],
  onSelect,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Подгружаем CSS Leaflet
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      const map = L.map(mapRef.current!).setView(defaultCenter, 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        setLoading(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`
          );
          const data = await res.json();
          const addr = data.address || {};

          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            "";
          const country = addr.country || "";
          const region = addr.state || addr.region || "";

          // Формируем "улицу" для поля адреса: улица + дом
          const street = addr.road || addr.street || addr.pedestrian || "";
          const house = addr.house_number || "";
          const addressLine = [street, house].filter(Boolean).join(", ");

          const fullAddress = data.display_name || `${lat}, ${lng}`;

          setSelectedAddress(fullAddress);
          setLoading(false);

          onSelect({
            lat,
            lng,
            city,
            address: addressLine,
            fullAddress,
            country,
            region,
          });
        } catch {
          setLoading(false);
          onSelect({
            lat,
            lng,
            city: "",
            address: "",
            fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          });
        }
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [defaultCenter, onSelect]);

  async function handleSearch() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          search
        )}&accept-language=ru`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, display_name, address } = data[0];
        const L = (await import("leaflet")).default;
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([parseFloat(lat), parseFloat(lon)], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([
              parseFloat(lat),
              parseFloat(lon),
            ]);
          } else {
            markerRef.current = L.marker([
              parseFloat(lat),
              parseFloat(lon),
            ]).addTo(map);
          }

          const a = address || {};
          const city =
            a.city || a.town || a.village || a.municipality || a.county || "";
          const country = a.country || "";
          const region = a.state || a.region || "";
          const street = a.road || a.street || "";
          const house = a.house_number || "";
          const addressLine = [street, house].filter(Boolean).join(", ");

          setSelectedAddress(display_name);
          onSelect({
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            city,
            address: addressLine,
            fullAddress: display_name,
            country,
            region,
          });
        }
      }
    } catch {
      // игнорируем
    }
    setSearching(false);
  }

  return (
    <div className="map-picker">
      <div className="map-picker-search">
        <div className="map-picker-input-wrap">
          <Search size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти город, улицу или адрес..."
            className="map-picker-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="button dark"
        >
          {searching ? "..." : "Найти"}
        </button>
      </div>

      <div ref={mapRef} className="map-picker-map" />

      {loading && <div className="map-picker-loading">Определяем адрес...</div>}

      {selectedAddress && !loading && (
        <div className="map-picker-selected">
          <MapPin size={14} />
          <span>{selectedAddress}</span>
        </div>
      )}

      <div className="map-picker-hint">
        Кликните в любом месте карты — город и адрес заполнятся автоматически.
      </div>
    </div>
  );
}