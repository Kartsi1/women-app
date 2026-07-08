import { create } from 'zustand';
import type { Listing } from '../types/listing';

/**
 * Listing store — mirrors profileStore shape per PATTERNS.
 *
 * listings[] — current search results from MapDiscoveryScreen
 * selectedListing — listing opened for detail view
 */
interface ListingState {
  listings: Listing[];
  selectedListing: Listing | null;
  setListings: (listings: Listing[]) => void;
  setSelectedListing: (listing: Listing | null) => void;
  clear: () => void;
}

export const useListingStore = create<ListingState>()((set) => ({
  listings: [],
  selectedListing: null,
  setListings: (listings) => set({ listings }),
  setSelectedListing: (selectedListing) => set({ selectedListing }),
  clear: () => set({ listings: [], selectedListing: null }),
}));
