const WALKING_SPEED_KMH = 5;
const DEFAULT_RADIUS_METERS = 150;

const state = {
  trips: [],
  culturalDestinations: [],
  currentPosition: null,
  radiusMeters: DEFAULT_RADIUS_METERS,
  enrichmentCache: {},
  activeTrip: null,
  activePois: [],
  tripSelection: 'auto',
  selectedDay: 1
};

const el = {
  currentTime: document.getElementById('current-time'),
  networkStatus: document.getElementById('network-status'),
  activeTrip: document.getElementById('active-trip'),
  selectionMode: document.getElementById('selection-mode'),
  tripDay: document.getElementById('trip-day'),
  currentLocation: document.getElementById('current-location'),
  tripCover: document.getElementById('trip-cover'),
  nextActivity: document.getElementById('next-activity'),
  activityDistance: document.getElementById('activity-distance'),
  walkingTime: document.getElementById('walking-time'),
  activityEntry: document.getElementById('activity-entry'),
  routeSummary: document.getElementById('route-summary'),
  routeLinks: document.getElementById('route-links'),
  ticketLinks: document.getElementById('ticket-links'),
  nextReview: document.getElementById('next-review'),
  mapPreview: document.getElementById('map-preview'),
  mapLinks: document.getElementById('map-links'),
  tripItinerary: document.getElementById('trip-itinerary'),
  culturalCard: document.getElementById('cultural-card'),
  tripGuide: document.getElementById('trip-guide'),
  tripSelector: document.getElementById('trip-selector'),
  daySelector: document.getElementById('day-selector'),
  radiusInput: document.getElementById('radius-input'),
  refreshBtn: document.getElementById('refresh-btn')
};

async function init() {
  updateClock();
  setInterval(updateClock, 1000);
  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  registerServiceWorker();

  try {
    const [itineraryRes, culturalRes] = await Promise.all([
      fetch('itinerary.json'),
      fetch('cultural_base.json')
    ]);

    const itineraryData = await itineraryRes.json();
    const culturalData = await culturalRes.json();

    state.trips = itineraryData.trips || [];
    state.culturalDestinations = culturalData.destinations || [];
    populateTripSelector(state.trips);
  } catch (error) {
    console.error('Failed to load local JSON files:', error);
    el.nextActivity.textContent = 'Unable to load itinerary data.';
    el.culturalCard.innerHTML = '<p>Unable to load cultural database.</p>';
    el.tripGuide.innerHTML = '<p>Unable to load trip cultural guide.</p>';
    return;
  }

  el.radiusInput.value = DEFAULT_RADIUS_METERS;
  el.refreshBtn.addEventListener('click', refreshRecommendations);
  el.tripSelector.addEventListener('change', () => {
    state.tripSelection = el.tripSelector.value;
    updateSelectionModeLabel();
    refreshRecommendations();
  });
  el.daySelector.addEventListener('change', () => {
    state.selectedDay = Number(el.daySelector.value);
    updateTripDayLabel();
    refreshRecommendations();
  });
  el.radiusInput.addEventListener('change', () => {
    state.radiusMeters = Math.max(50, Number(el.radiusInput.value) || DEFAULT_RADIUS_METERS);
    refreshRecommendations();
  });

  refreshRecommendations();
}

function updateClock() {
  const now = new Date();
  el.currentTime.textContent = now.toLocaleString();
}

function updateNetworkStatus() {
  el.networkStatus.textContent = navigator.onLine ? 'Online' : 'Offline';
}

function updateSelectionModeLabel() {
  if (state.tripSelection === 'auto') {
    el.selectionMode.textContent = 'Auto (by GPS)';
    return;
  }

  const selectedTrip = state.trips.find((trip) => trip.id === state.tripSelection);
  el.selectionMode.textContent = selectedTrip ? `Manual (${selectedTrip.name})` : 'Manual';
}

function updateTripDayLabel() {
  el.tripDay.textContent = `Day ${state.selectedDay}`;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then((registration) => registration.update())
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    });
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 10_000
    });
  });
}

async function refreshRecommendations() {
  try {
    const position = await getCurrentPosition();
    state.currentPosition = {
      lat: position.coords.latitude,
      lon: position.coords.longitude
    };

    el.currentLocation.textContent = `${state.currentPosition.lat.toFixed(6)}, ${state.currentPosition.lon.toFixed(6)}`;

    const selectedTrip = chooseActiveTrip(state.trips, state.currentPosition, state.tripSelection);
    state.activeTrip = selectedTrip;
    state.activePois = getDestinationPois(selectedTrip?.id, state.culturalDestinations);
    el.activeTrip.textContent = selectedTrip ? selectedTrip.name : 'No matching trip';

    if (!selectedTrip) {
      el.daySelector.innerHTML = '<option value=\"1\">Day 1</option>';
      updateTripDayLabel();
      el.tripCover.innerHTML = '<p>No trip cover available for this location.</p>';
      el.nextActivity.textContent = 'No trip available for this location.';
      el.activityDistance.textContent = '';
      el.walkingTime.textContent = '';
      el.activityEntry.textContent = '';
      el.routeSummary.textContent = '';
      el.routeLinks.innerHTML = '';
      el.ticketLinks.innerHTML = '';
      el.nextReview.textContent = '';
      el.mapPreview.removeAttribute('src');
      el.mapLinks.innerHTML = '';
      el.tripItinerary.innerHTML = '<p>No itinerary available.</p>';
      el.culturalCard.innerHTML = '<p>No nearby cultural points available.</p>';
      el.tripGuide.innerHTML = '<p>No destination guide available for this location.</p>';
      return;
    }

    populateDaySelector(selectedTrip);
    updateTripDayLabel();
    const dayActivities = getActivitiesForSelectedDay(selectedTrip);

    const recommended = recommendNextActivity(dayActivities, state.currentPosition);
    renderTripCover(selectedTrip);
    renderItinerary(dayActivities, recommended, state.currentPosition);
    renderActivity(recommended);
    renderRoute(recommended, state.currentPosition);
    renderRecommendedReview(recommended, state.activePois);
    renderMapPreview(recommended, dayActivities, state.currentPosition);

    const nearbyPois = findNearbyPois(state.activePois, state.currentPosition, state.radiusMeters);
    await renderCulturalInfo(nearbyPois);
    renderTripGuide(selectedTrip, state.activePois, dayActivities);
  } catch (error) {
    console.error('Location/recommendation error:', error);
    el.currentLocation.textContent = 'Could not read GPS location. Please allow location access.';
    el.activeTrip.textContent = '--';
    updateSelectionModeLabel();
    updateTripDayLabel();
    el.nextActivity.textContent = 'Recommendation unavailable without location.';
    el.activityDistance.textContent = '';
    el.walkingTime.textContent = '';
    el.activityEntry.textContent = '';
    el.routeSummary.textContent = '';
    el.routeLinks.innerHTML = '';
    el.ticketLinks.innerHTML = '';
    el.nextReview.textContent = '';
    el.mapPreview.removeAttribute('src');
    el.mapLinks.innerHTML = '';
    el.tripCover.innerHTML = '<p>Trip cover unavailable without location.</p>';
    el.tripItinerary.innerHTML = '<p>Itinerary unavailable without location.</p>';
    el.culturalCard.innerHTML = '<p>Nearby cultural info unavailable without location.</p>';
    el.tripGuide.innerHTML = '<p>Trip guide unavailable without location.</p>';
  }
}

function chooseTripByLocation(trips, currentPosition) {
  if (!trips.length) {
    return null;
  }

  let bestTrip = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const trip of trips) {
    const distance = haversineMeters(
      currentPosition.lat,
      currentPosition.lon,
      trip.regionCenter.lat,
      trip.regionCenter.lon
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTrip = trip;
    }
  }

  return bestTrip;
}

function chooseActiveTrip(trips, currentPosition, selection) {
  if (!trips.length) {
    return null;
  }

  if (selection && selection !== 'auto') {
    const selected = trips.find((trip) => trip.id === selection);
    if (selected) {
      return selected;
    }
  }

  return chooseTripByLocation(trips, currentPosition);
}

function populateTripSelector(trips) {
  const options = [
    '<option value="auto">Auto (by GPS)</option>',
    ...trips.map((trip) => `<option value="${escapeHTML(trip.id)}">${escapeHTML(trip.name)}</option>`)
  ];
  el.tripSelector.innerHTML = options.join('');
  el.tripSelector.value = state.tripSelection;
  updateSelectionModeLabel();
}

function getTripDays(trip) {
  if (!trip || !trip.activities) {
    return [1];
  }
  const days = [...new Set(trip.activities.map((activity) => activity.day || 1))].sort((a, b) => a - b);
  return days.length ? days : [1];
}

function populateDaySelector(trip) {
  const days = getTripDays(trip);
  if (!days.includes(state.selectedDay)) {
    state.selectedDay = days[0];
  }

  el.daySelector.innerHTML = days
    .map((day) => `<option value=\"${day}\">Day ${day}</option>`)
    .join('');
  el.daySelector.value = String(state.selectedDay);
}

function getActivitiesForSelectedDay(trip) {
  if (!trip || !trip.activities) {
    return [];
  }
  return trip.activities.filter((activity) => (activity.day || 1) === state.selectedDay);
}

function renderMapPreview(recommendedActivity, dayActivities, currentPosition) {
  if (!recommendedActivity || !currentPosition) {
    el.mapPreview.removeAttribute('src');
    el.mapLinks.innerHTML = '<span class="muted">Map preview unavailable.</span>';
    return;
  }

  const lat = recommendedActivity.location.lat;
  const lon = recommendedActivity.location.lon;
  const mapPreviewUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=14&output=embed`;
  el.mapPreview.src = mapPreviewUrl;

  const nextRouteUrl = buildGoogleDirectionsUrl(currentPosition, [recommendedActivity], recommendedActivity.location);
  const dayRouteUrl = buildDayRouteUrl(currentPosition, dayActivities);

  const dayLink = dayRouteUrl
    ? `<a class="route-link" href="${dayRouteUrl}" target="_blank" rel="noopener noreferrer">Open full day route</a>`
    : '';

  el.mapLinks.innerHTML = `
    <a class="route-link" href="${nextRouteUrl}" target="_blank" rel="noopener noreferrer">Open route to next stop</a>
    ${dayLink}
  `;
}

function buildDayRouteUrl(currentPosition, dayActivities) {
  if (!dayActivities || !dayActivities.length) {
    return '';
  }

  const ordered = [...dayActivities].sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return aH * 60 + aM - (bH * 60 + bM);
  });

  const destination = ordered[ordered.length - 1].location;
  return buildGoogleDirectionsUrl(currentPosition, ordered, destination);
}

function buildGoogleDirectionsUrl(origin, waypointsActivities, destination) {
  const originParam = `${origin.lat},${origin.lon}`;
  const destinationParam = `${destination.lat},${destination.lon}`;
  const waypointCoords = waypointsActivities
    .slice(0, Math.max(0, waypointsActivities.length - 1))
    .map((activity) => `${activity.location.lat},${activity.location.lon}`);

  const waypointsParam = waypointCoords.length ? `&waypoints=${encodeURIComponent(waypointCoords.join('|'))}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destinationParam)}${waypointsParam}&travelmode=walking`;
}

function getDestinationPois(tripId, destinations) {
  const destination = destinations.find((item) => item.tripId === tripId);
  return destination ? destination.pois : [];
}

function findPoiById(pois, poiId) {
  return pois.find((poi) => poi.id === poiId) || null;
}

function renderTripCover(trip) {
  const coverSrc = trip.coverImage || '';
  const coverCaption = trip.coverCaption || 'Cultural trip overview';
  el.tripCover.innerHTML = `
    <div class="cover-frame">
      <img src="${escapeHTML(coverSrc)}" alt="${escapeHTML(trip.name)} cover image" />
      <div class="cover-meta">
        <p class="value">${escapeHTML(trip.name)}</p>
        <p class="muted">${escapeHTML(coverCaption)}</p>
      </div>
    </div>
  `;
}

function renderRecommendedReview(activity, pois) {
  if (!activity) {
    el.nextReview.textContent = '';
    return;
  }

  const poi = findPoiById(pois, activity.poiId);
  if (!poi || !poi.culturalInfo) {
    el.nextReview.textContent = '';
    return;
  }

  el.nextReview.textContent = poi.culturalInfo;
}

function renderItinerary(dayActivities, recommendedActivity, currentPosition) {
  if (!dayActivities?.length) {
    el.tripItinerary.innerHTML = '<p>No itinerary available.</p>';
    return;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const list = dayActivities.map((activity) => {
    const [startH, startM] = activity.startTime.split(':').map(Number);
    const [endH, endM] = activity.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const distance = haversineMeters(
      currentPosition.lat,
      currentPosition.lon,
      activity.location.lat,
      activity.location.lon
    );
    const isRecommended = recommendedActivity && activity.id === recommendedActivity.id;
    const isCurrent = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    const isPast = nowMinutes > endMinutes;

    const tags = [];
    if (isRecommended) {
      tags.push('<span class="tag tag-next">Recommended</span>');
    }
    if (isCurrent) {
      tags.push('<span class="tag tag-current">Now</span>');
    } else if (isPast) {
      tags.push('<span class="tag tag-past">Past</span>');
    } else {
      tags.push('<span class="tag">Upcoming</span>');
    }
    if (activity.priority === 'must') {
      tags.push('<span class="tag tag-priority-must">Must</span>');
    } else {
      tags.push('<span class="tag">Optional</span>');
    }

    return `
      <div class="itinerary-item">
        <h3>${escapeHTML(activity.title)}</h3>
        <p class="muted">${escapeHTML(activity.startTime)} - ${escapeHTML(activity.endTime)} | ${distance.toFixed(0)} m away</p>
        <p class="muted">Entry: ${escapeHTML(normalizeEntryType(activity.entryType))}</p>
        ${activity.ticketLink ? `<p><a class="route-link" href="${escapeHTML(activity.ticketLink)}" target="_blank" rel="noopener noreferrer">Tickets</a></p>` : ''}
        <div class="tag-row">${tags.join('')}</div>
      </div>
    `;
  });

  el.tripItinerary.innerHTML = `<div class="itinerary-list">${list.join('')}</div>`;
}

function recommendNextActivity(activities, currentPosition) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const scored = activities.map((activity, index) => {
    const distanceMeters = haversineMeters(
      currentPosition.lat,
      currentPosition.lon,
      activity.location.lat,
      activity.location.lon
    );

    const [startH, startM] = activity.startTime.split(':').map(Number);
    const [endH, endM] = activity.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const withinWindow = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    const minutesToStart = startMinutes - nowMinutes;
    const minutesSinceEnd = nowMinutes - endMinutes;

    const priorityScore = activity.priority === 'must' ? 300 : 120;

    let timeScore;
    if (withinWindow) {
      timeScore = 2000;
    } else if (minutesToStart > 0) {
      timeScore = Math.max(0, 900 - minutesToStart);
    } else {
      timeScore = -400 - Math.abs(minutesSinceEnd);
    }

    const distanceScore = -(distanceMeters / 50);

    return {
      ...activity,
      distanceMeters,
      withinWindow,
      totalScore: timeScore + priorityScore + distanceScore,
      originalIndex: index
    };
  });

  scored.sort((a, b) =>
    b.totalScore - a.totalScore ||
    (b.withinWindow ? 1 : 0) - (a.withinWindow ? 1 : 0) ||
    a.distanceMeters - b.distanceMeters ||
    a.originalIndex - b.originalIndex
  );

  return scored[0] || null;
}

function renderActivity(activity) {
  if (!activity) {
    el.nextActivity.textContent = 'No activities available in itinerary.';
    el.activityDistance.textContent = '';
    el.walkingTime.textContent = '';
    el.activityEntry.textContent = '';
    el.ticketLinks.innerHTML = '';
    return;
  }

  const km = activity.distanceMeters / 1000;
  const walkMinutes = (km / WALKING_SPEED_KMH) * 60;
  const windowNote = activity.withinWindow ? ' (in time window)' : ' (outside preferred time window)';

  el.nextActivity.textContent = `${activity.title}${windowNote}`;
  el.activityDistance.textContent = `Distance: ${activity.distanceMeters.toFixed(0)} m`;
  el.walkingTime.textContent = `Est. walk time: ${walkMinutes.toFixed(1)} min`;
  const entryLabel = normalizeEntryType(activity.entryType);
  el.activityEntry.textContent = `Entry: ${entryLabel}`;

  if (activity.ticketLink) {
    el.ticketLinks.innerHTML = `<a class="route-link" href="${escapeHTML(activity.ticketLink)}" target="_blank" rel="noopener noreferrer">Open tickets</a>`;
  } else {
    el.ticketLinks.innerHTML = '';
  }
}

function normalizeEntryType(entryType) {
  const raw = (entryType || '').trim();
  if (!raw) {
    return 'Unknown';
  }

  const low = raw.toLowerCase();
  if (low.includes('gratis') || low.includes('free')) {
    return `Free (${raw})`;
  }
  if (low.includes('pago') || low.includes('paid') || low.includes('ticket')) {
    return `Paid (${raw})`;
  }
  if (low.includes('variable')) {
    return `Variable (${raw})`;
  }
  if (low.includes('reserva')) {
    return `Reservation (${raw})`;
  }

  return raw;
}

function renderRoute(activity, currentPosition) {
  if (!activity) {
    el.routeSummary.textContent = '';
    el.routeLinks.innerHTML = '';
    return;
  }

  const bearing = getBearingDegrees(
    currentPosition.lat,
    currentPosition.lon,
    activity.location.lat,
    activity.location.lon
  );
  const cardinal = bearingToCardinal(bearing);
  const km = activity.distanceMeters / 1000;
  const walkMinutes = (km / WALKING_SPEED_KMH) * 60;

  el.routeSummary.textContent = `Route: head ${cardinal} (${Math.round(bearing)}°). Approx. ${walkMinutes.toFixed(1)} min walking.`;

  if (!navigator.onLine) {
    el.routeLinks.innerHTML = '<span class="muted">Map links available when online.</span>';
    return;
  }

  const lat = activity.location.lat;
  const lon = activity.location.lon;
  const appleMaps = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=w`;
  const googleMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;

  el.routeLinks.innerHTML = `
    <a class="route-link" href="${appleMaps}" target="_blank" rel="noopener noreferrer">Open in Apple Maps</a>
    <a class="route-link" href="${googleMaps}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
  `;
}

function findNearbyPois(pois, currentPosition, radiusMeters) {
  return pois
    .map((poi) => ({
      ...poi,
      distanceMeters: haversineMeters(
        currentPosition.lat,
        currentPosition.lon,
        poi.location.lat,
        poi.location.lon
      )
    }))
    .filter((poi) => poi.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

async function renderCulturalInfo(pois) {
  if (!pois.length) {
    el.culturalCard.innerHTML = `<p>No cultural POIs found within ${state.radiusMeters}m.</p>`;
    return;
  }

  const cards = await Promise.all(
    pois.map(async (poi) => {
      const enriched = await getOnlineEnhancement(poi.name);
      const onlineText = enriched
        ? `<p class="muted"><strong>Extra:</strong> ${escapeHTML(enriched)}</p>`
        : '<p class="muted">Offline source: local cultural database.</p>';

      return `
        <div class="poi-item">
          <h3>${escapeHTML(poi.name)}</h3>
          <p><strong>Distance:</strong> ${poi.distanceMeters.toFixed(0)} m</p>
          <p><strong>Era:</strong> ${escapeHTML(poi.era)}</p>
          <p>${escapeHTML(poi.description)}</p>
          <p class="long-copy"><strong>Cultural insight:</strong> ${escapeHTML(poi.culturalInfo.slice(0, 260))}...</p>
          ${onlineText}
        </div>
      `;
    })
  );

  el.culturalCard.innerHTML = cards.join('');
}

function renderTripGuide(trip, pois, dayActivities) {
  if (!trip || !pois.length || !dayActivities.length) {
    el.tripGuide.innerHTML = '<p>No detailed trip guide available.</p>';
    return;
  }

  const guideItems = dayActivities
    .map((activity) => {
      const poi = findPoiById(pois, activity.poiId);
      if (!poi) {
        return '';
      }
      return `
        <div class="poi-item">
          <h3>${escapeHTML(activity.title)}</h3>
          <p><strong>Place:</strong> ${escapeHTML(poi.name)}</p>
          <p><strong>Time:</strong> ${escapeHTML(activity.startTime)} - ${escapeHTML(activity.endTime)}</p>
          <p><strong>Entry:</strong> ${escapeHTML(normalizeEntryType(activity.entryType))}</p>
          ${activity.ticketLink ? `<p><a class="route-link" href="${escapeHTML(activity.ticketLink)}" target="_blank" rel="noopener noreferrer">Open tickets</a></p>` : ''}
          <p><strong>Relevance:</strong> ${escapeHTML(poi.relevance || 'Cultural stop')}</p>
          <p class="long-copy">${escapeHTML(poi.culturalInfo)}</p>
        </div>
      `;
    })
    .filter(Boolean);

  el.tripGuide.innerHTML = guideItems.length
    ? guideItems.join('')
    : '<p>No detailed trip guide available.</p>';
}

async function getOnlineEnhancement(poiName) {
  if (!navigator.onLine) {
    return '';
  }

  if (state.enrichmentCache[poiName]) {
    return state.enrichmentCache[poiName];
  }

  try {
    const wikipediaSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(poiName)}`;
    const response = await fetch(wikipediaSummaryUrl);
    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    const enhancedText = data.extract ? data.extract.slice(0, 220) : '';
    state.enrichmentCache[poiName] = enhancedText;
    return enhancedText;
  } catch (error) {
    console.warn('Optional online enhancement unavailable:', error);
    return '';
  }
}

function getBearingDegrees(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingToCardinal(bearing) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(bearing / 45) % 8];
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Haversine distance in meters between two GPS coordinates.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

init();
