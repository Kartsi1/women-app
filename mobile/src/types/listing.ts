/**
 * Listing type — housing listing for the WomenApp platform.
 *
 * Address hiding (LIST-03 / T-02-02-01):
 *   - `neighbourhoodCoords` or `location.coordinates` = neighbourhood centroid [lng, lat].
 *     Safe to render on the map. Convert to MapView format: latitude=coords[1], longitude=coords[0].
 *   - `exactAddress` is null in this slice (02-02). Revealed only after host accepts a
 *     StayRequest (REQT-03, implemented in plan 02-03).
 *   - Client NEVER infers the address from coordinates.
 */

export interface AvailabilityDate {
  from: string; // ISO date string
  to: string;   // ISO date string
}

export interface Listing {
  /** MongoDB ObjectId as string */
  id: string;

  title: string;
  description?: string;
  houseRules?: string;
  ownerUid: string;

  /**
   * Neighbourhood centroid — [longitude, latitude] (GeoJSON order, longitude FIRST).
   * To use with react-native-maps MapView Marker:
   *   latitude:  neighbourhoodCoords[1]
   *   longitude: neighbourhoodCoords[0]
   */
  neighbourhoodCoords?: [number, number];

  /**
   * Alternative shape returned by searchListings — matches the $project output.
   * Use location.coordinates[1] for latitude, [0] for longitude.
   */
  location?: {
    coordinates: [number, number]; // [lng, lat] — longitude first
  };

  photos: string[];          // signed URL strings (resolved by backend)
  photoUrl?: string | null;  // first photo signed URL (from search results)

  availabilityDates: AvailabilityDate[];

  citySlug?: string;
  isActive?: boolean;
  distance?: number; // metres from search centre (search results only)

  /**
   * Address reveal state (T-02-02-01).
   * Always false in plan 02-02 for guests.
   * Revealed in plan 02-03 when StayRequest is accepted.
   */
  addressRevealed: boolean;

  /**
   * null in plan 02-02. Populated only for the host or after StayRequest acceptance.
   */
  exactAddress: string | null;

  /**
   * True if the requesting user is the listing owner.
   * Used to show "Manage listing" instead of "Request stay".
   */
  isOwner?: boolean;
}

/** Parameters for searchListings API call */
export interface SearchListingsParams {
  lat: number;
  lng: number;
  radiusM?: number;
  fromDate?: string;
  toDate?: string;
}

/** Payload for creating a listing */
export interface CreateListingPayload {
  title: string;
  description?: string;
  houseRules?: string;
  citySlug: string;
  exactAddress: string;
  /** [longitude, latitude] — longitude FIRST per GeoJSON spec */
  coordinates: [number, number];
  availabilityDates?: AvailabilityDate[];
  /** Local file URIs for photos */
  photoUris?: string[];
}
