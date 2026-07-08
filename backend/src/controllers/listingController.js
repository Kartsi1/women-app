const Listing = require('../models/Listing');
const { uploadFile, getSignedUrl } = require('../services/storageService');

/**
 * POST /api/listings
 *
 * Create a new housing listing.
 * Security: T-02-02-01 — exactAddress stored but never exposed in responses here.
 * Security: T-02-02-04 — multer limits photo count/size (enforced in router).
 *
 * Body fields (multipart/form-data):
 *   - title (required)
 *   - description (max 2000)
 *   - houseRules (max 1000)
 *   - citySlug (required — slugified homeCity sent by client)
 *   - exactAddress (required — stored, never returned to non-accepted guests)
 *   - coordinates (required JSON string "[lng, lat]" — longitude first, GeoJSON)
 *   - availabilityDates (optional JSON string [{from, to}, ...])
 * Files:
 *   - photos[] (up to 10, max 5MB each — enforced by multer in router)
 */
async function createListing(req, res) {
  try {
    const { uid } = req.user;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, houseRules, citySlug, exactAddress, coordinates, availabilityDates } = req.body;

    // --- Validate required fields ---
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!citySlug || typeof citySlug !== 'string' || citySlug.trim().length === 0) {
      return res.status(400).json({ error: 'citySlug is required' });
    }
    if (!exactAddress || typeof exactAddress !== 'string' || exactAddress.trim().length === 0) {
      return res.status(400).json({ error: 'exactAddress is required' });
    }

    // --- Validate coordinates (T-02-02-02 Tampering mitigation) ---
    let coords;
    try {
      coords = typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates;
    } catch {
      return res.status(400).json({ error: 'coordinates must be a valid JSON array [lng, lat]' });
    }

    if (!Array.isArray(coords) || coords.length !== 2) {
      return res.status(400).json({ error: 'coordinates must be [lng, lat]' });
    }

    const [lng, lat] = coords.map(Number);
    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ error: 'coordinates must be numbers' });
    }
    // GeoJSON longitude: -180..180, latitude: -90..90
    if (lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'longitude must be between -180 and 180' });
    }
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'latitude must be between -90 and 90' });
    }

    // --- Validate lengths ---
    if (description && description.length > 2000) {
      return res.status(400).json({ error: 'description must not exceed 2000 characters' });
    }
    if (houseRules && houseRules.length > 1000) {
      return res.status(400).json({ error: 'houseRules must not exceed 1000 characters' });
    }

    // --- Parse and validate availabilityDates ---
    let parsedDates = [];
    if (availabilityDates) {
      try {
        parsedDates = typeof availabilityDates === 'string'
          ? JSON.parse(availabilityDates)
          : availabilityDates;
      } catch {
        return res.status(400).json({ error: 'availabilityDates must be valid JSON' });
      }

      if (!Array.isArray(parsedDates)) {
        return res.status(400).json({ error: 'availabilityDates must be an array' });
      }

      for (const d of parsedDates) {
        if (!d.from || isNaN(Date.parse(d.from))) {
          return res.status(400).json({ error: 'Each availabilityDate must have a valid from date' });
        }
        if (!d.to || isNaN(Date.parse(d.to))) {
          return res.status(400).json({ error: 'Each availabilityDate must have a valid to date' });
        }
      }
    }

    // --- Create the listing document (without photos first, to get _id for storage path) ---
    const listing = await Listing.create({
      ownerUid: uid,
      title: title.trim(),
      description: description || undefined,
      houseRules: houseRules || undefined,
      location: {
        type: 'Point',
        // [lng, lat] — longitude FIRST per GeoJSON spec (Pitfall 2)
        coordinates: [lng, lat],
      },
      exactAddress: exactAddress.trim(), // exactAddress deliberately omitted from all responses
      citySlug: citySlug.trim(),
      availabilityDates: parsedDates.map((d) => ({
        from: new Date(d.from),
        to: new Date(d.to),
      })),
    });

    // --- Upload photos (mirrors uploadProfilePhoto pattern from userController) ---
    const photoPaths = [];
    const files = req.files || [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storagePath = `listings/${listing._id}/photos/${i}`;
      await uploadFile(storagePath, file.buffer, file.mimetype);
      photoPaths.push(storagePath);
    }

    // --- Persist photo paths ---
    if (photoPaths.length > 0) {
      listing.photos = photoPaths;
      await listing.save();
    }

    res.status(201).json({ data: { id: listing._id } });
  } catch (err) {
    console.error('[createListing]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/listings/search
 *
 * Geo-search listings within a radius, optionally filtered by availability dates.
 *
 * Security (T-02-02-01): exactAddress is NEVER included in results ($project omits it).
 * Security (T-02-02-02): lat/lng/radiusM validated before $geoNear.
 *
 * Query params:
 *   - lat (required) — latitude of the search centre
 *   - lng (required) — longitude of the search centre
 *   - radiusM (optional, default 10000, clamped 1..50000) — search radius in metres
 *   - fromDate (optional ISO date) — filter listings available from this date
 *   - toDate   (optional ISO date) — filter listings available until this date
 */
async function searchListings(req, res) {
  try {
    const { lat, lng, radiusM = 10000, fromDate, toDate } = req.query;

    // --- Validate coordinates (T-02-02-02) ---
    if (lat === undefined || lat === null || lat === '') {
      return res.status(400).json({ error: 'lat is required' });
    }
    if (lng === undefined || lng === null || lng === '') {
      return res.status(400).json({ error: 'lng is required' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }
    if (latNum < -90 || latNum > 90) {
      return res.status(400).json({ error: 'lat must be between -90 and 90' });
    }
    if (lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'lng must be between -180 and 180' });
    }

    // Clamp radiusM to 1..50000 (T-02-02-02)
    let radius = parseInt(radiusM, 10);
    if (isNaN(radius) || radius < 1) radius = 1;
    if (radius > 50000) radius = 50000;

    // --- Build match filter ---
    const matchFilter = { isActive: true };

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({ error: 'fromDate and toDate must be valid ISO dates' });
      }
      // Listing must have at least one availability window overlapping the requested range
      matchFilter['availabilityDates'] = {
        $elemMatch: {
          from: { $lte: to },
          to:   { $gte: from },
        },
      };
    }

    // --- Run $geoNear aggregation ---
    const listings = await Listing.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            // [lng, lat] — longitude FIRST per GeoJSON spec (Pitfall 2)
            coordinates: [lngNum, latNum],
          },
          distanceField: 'distance',
          maxDistance: radius,
          spherical: true,
          query: matchFilter, // combined geo + active + date filter
        },
      },
      { $limit: 50 },
      {
        // Explicit projection — exactAddress deliberately omitted (T-02-02-01)
        $project: {
          title: 1,
          description: 1,
          ownerUid: 1,
          photos: { $slice: ['$photos', 1] }, // first photo only for listing card
          availabilityDates: 1,
          distance: 1,
          // Neighbourhood centroid coordinates — safe to send
          'location.coordinates': 1,
          // exactAddress is NOT projected
        },
      },
    ]);

    // --- Resolve first photo paths to signed URLs ---
    const enriched = await Promise.all(
      listings.map(async (listing) => {
        let photoUrl = null;
        if (listing.photos && listing.photos.length > 0) {
          try {
            photoUrl = await getSignedUrl(listing.photos[0]);
          } catch {
            // Non-fatal — photo URL generation may fail if Firebase not configured
            photoUrl = null;
          }
        }
        return {
          ...listing,
          // exactAddress deliberately omitted
          photoUrl,
        };
      })
    );

    res.json({ data: enriched });
  } catch (err) {
    console.error('[searchListings]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/listings/:id
 *
 * Fetch a listing's detail view.
 *
 * Security (T-02-02-01): exactAddress is set to null in THIS slice.
 *   addressRevealed=false for all users in plan 02-02 — the accepted-StayRequest
 *   reveal is implemented in plan 02-03 once StayRequest model exists.
 *
 * Never spread the raw document — build an explicit data object (getProfile pattern).
 */
async function getListingDetail(req, res) {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Resolve all photo paths to signed URLs
    const photoUrls = await Promise.all(
      (listing.photos || []).map(async (path) => {
        try {
          return await getSignedUrl(path);
        } catch {
          return null;
        }
      })
    );

    // Build explicit projection — NEVER spread the raw document (Pitfall 5)
    // exactAddress is deliberately set to null in this slice (02-02).
    // The accepted-StayRequest reveal (REQT-03) is wired in plan 02-03.
    const data = {
      id: listing._id,
      title: listing.title,
      description: listing.description,
      houseRules: listing.houseRules,
      ownerUid: listing.ownerUid,
      // Neighbourhood centroid — safe to send (never the exact address coords)
      neighbourhoodCoords: listing.location.coordinates, // [lng, lat]
      photos: photoUrls.filter(Boolean),
      availabilityDates: listing.availabilityDates,
      citySlug: listing.citySlug,
      isActive: listing.isActive,
      // exactAddress deliberately set to null until StayRequest accepted (02-03)
      exactAddress: null,
      addressRevealed: false,
      // Owner flag — client uses to show "Manage listing" vs "Request stay"
      isOwner: listing.ownerUid === req.user.uid,
    };

    res.json({ data });
  } catch (err) {
    console.error('[getListingDetail]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createListing, searchListings, getListingDetail };
