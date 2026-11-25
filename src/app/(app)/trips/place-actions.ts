"use server";

import { signedInClient } from "./action-helpers";
import {
  persistMapboxDestination,
  persistMapboxPlace,
  persistPinnedPlace,
  type DestinationSearchHit,
  type PlaceSearchHit,
} from "@/lib/place-search";
import type { PlaceSummary } from "@/lib/data/catalog";

const MAPBOX_ID = /^[A-Za-z0-9_:=+-]{8,256}$/;

export async function saveMapboxPlace(
  hit: PlaceSearchHit,
  destinationId: string | null,
  sessionToken: string,
): Promise<{ ok: true; place: PlaceSummary } | { ok: false; error: string }> {
  await signedInClient();
  if (!hit.mapboxId || !MAPBOX_ID.test(hit.mapboxId)) {
    return { ok: false, error: "That place isn't available anymore. Search again." };
  }
  if (destinationId && !/^[0-9a-f-]{36}$/i.test(destinationId)) {
    return { ok: false, error: "That destination isn't available." };
  }
  try {
    const place = await persistMapboxPlace({ ...hit, destinationId, sessionToken });
    return { ok: true, place };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Couldn't save that place. Try again." };
  }
}

export async function savePinnedPlace(input: {
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  destinationId: string;
}): Promise<{ ok: true; place: PlaceSummary } | { ok: false; error: string }> {
  await signedInClient();
  if (!/^[0-9a-f-]{36}$/i.test(input.destinationId)) {
    return { ok: false, error: "Add a destination to this trip first." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the pin a name." };
  try {
    const place = await persistPinnedPlace({
      name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      destinationId: input.destinationId,
    });
    return { ok: true, place };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Couldn't save that pin. Try again." };
  }
}

export async function saveMapboxDestination(
  hit: DestinationSearchHit,
  sessionToken: string,
): Promise<{ ok: true; destination: { id: string; name: string; country: string } } | { ok: false; error: string }> {
  await signedInClient();
  if (!hit.mapboxId || !MAPBOX_ID.test(hit.mapboxId) || !hit.name.trim() || !hit.country.trim()) {
    return { ok: false, error: "That destination isn't available anymore. Search again." };
  }
  try {
    const destination = await persistMapboxDestination({
      mapboxId: hit.mapboxId,
      name: hit.name,
      country: hit.country,
      region: hit.region,
      lat: hit.lat,
      lng: hit.lng,
      sessionToken,
    });
    if (!destination.id) return { ok: false, error: "Couldn't save that destination. Try again." };
    return { ok: true, destination: { id: destination.id, name: destination.name, country: destination.country } };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Couldn't save that destination. Try again." };
  }
}
