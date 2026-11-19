import assert from 'node:assert/strict';
import {
  buildCartoDarkMatterStyle,
  resolveTacticalBasemap,
  isValidCoordinate,
  createRangeRingCoordinates,
  buildAircraftTrailsGeoJSON,
  buildHeadingVectorsGeoJSON,
  buildHazardZonesGeoJSON,
  buildAirspaceOverlayGeoJSON,
  buildTacticalGraticuleGeoJSON,
  advanceSimulatedFlight
} from '../src/radar/radarUtils.ts';
import { INITIAL_FLIGHTS } from '../src/data/mockData.ts';

// 1. CARTO Dark Matter API key formatting & attribution preservation
const cartoStyle = buildCartoDarkMatterStyle('my_real_carto_key_123');
const cartoSource = cartoStyle.sources['carto-dark'] as { tiles: string[]; attribution: string };
assert.equal(cartoSource.tiles.length, 4, 'CARTO style must include all 4 tile subdomains');
for (const url of cartoSource.tiles) {
  assert.ok(url.includes('basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?api_key=my_real_carto_key_123'), `Tile URL missing api_key: ${url}`);
}
assert.ok(cartoSource.attribution.includes('OpenStreetMap'), 'Must preserve OpenStreetMap attribution');
assert.ok(cartoSource.attribution.includes('CARTO'), 'Must preserve CARTO attribution');

// 2. Basemap resolution with & without CARTO key (no fake keys!)
const withoutKey = resolveTacticalBasemap('');
assert.equal(withoutKey.provider, 'esri-dark-gray');
assert.equal(withoutKey.hasCartoKey, false);

const withKey = resolveTacticalBasemap('valid_carto_token');
assert.equal(withKey.provider, 'carto-dark-matter');
assert.equal(withKey.hasCartoKey, true);

// 3. Coordinate validation
assert.equal(isValidCoordinate(25.2532, 55.3657), true);
assert.equal(isValidCoordinate(Number.NaN, 55.36), false);
assert.equal(isValidCoordinate(95, 55.36), false);

// 4. Range rings & airspace / hazard overlays
const ring = createRangeRingCoordinates([55.3657, 25.2532], 46.3, 64);
assert.equal(ring.length, 65, 'Closed geodesic ring must have points + 1 vertices');
const airspace = buildAirspaceOverlayGeoJSON();
assert.equal(airspace.features.length, 1);
const hazards = buildHazardZonesGeoJSON();
assert.ok(hazards.features.length >= 2, 'Hazard zones must be generated');
for (const h of hazards.features) {
  assert.ok(['#f59e0b', '#ef4444'].includes(String(h.properties.lineColor)), 'Hazards must be visually distinct amber/red');
}

// 5. Aircraft dataset, trails, heading vectors & movement bounds
assert.ok(INITIAL_FLIGHTS.length >= 10 && INITIAL_FLIGHTS.length <= 20, `Expected 10-20 simulated aircraft, got ${INITIAL_FLIGHTS.length}`);

const clonedFlights = INITIAL_FLIGHTS.map((f) => ({
  ...f,
  vectorHistory: f.vectorHistory.map((pt) => [pt[0], pt[1]] as [number, number])
}));

const trails = buildAircraftTrailsGeoJSON(clonedFlights, clonedFlights[0]!.id);
assert.equal(trails.features.length, clonedFlights.length, 'Every valid aircraft must have a GeoJSON trail');
assert.equal(trails.features[0]!.properties.isSelected, true, 'Selected aircraft trail must be highlighted');
for (const feat of trails.features) {
  assert.equal(feat.geometry.type, 'LineString');
  if (feat.geometry.type === 'LineString') {
    assert.ok(feat.geometry.coordinates.length >= 2, 'Trail must contain at least 2 points');
    // Verify [lng, lat] GeoJSON coordinate order around Dubai (~55E, ~25N)
    const [lng, lat] = feat.geometry.coordinates[feat.geometry.coordinates.length - 1]!;
    assert.ok(lng > 50 && lng < 60, `Expected Dubai longitude in GeoJSON [lng, lat], got ${lng}`);
    assert.ok(lat > 20 && lat < 30, `Expected Dubai latitude in GeoJSON [lng, lat], got ${lat}`);
  }
}

const vectors = buildHeadingVectorsGeoJSON(clonedFlights, clonedFlights[0]!.id, 2.5);
assert.equal(vectors.features.length, clonedFlights.length, 'Every aircraft must have a forward heading vector');

// 6. Continuous simulated movement & bounded track history (zero memory growth)
const sample = clonedFlights[0]!;
const startLat = sample.lat;
const startLng = sample.lng;
for (let i = 0; i < 35; i++) {
  advanceSimulatedFlight(sample, 1.0);
}
assert.ok(sample.lat !== startLat || sample.lng !== startLng, 'Simulated aircraft position must update over time');
assert.equal(sample.isSimulated, true, 'Simulated aircraft must stay flagged isSimulated=true');
assert.ok(sample.vectorHistory.length <= 20, `vectorHistory must be capped at 20 points, got ${sample.vectorHistory.length}`);

// 7. Tactical radar graticule (coordinate grid lines and radial spokes)
const graticule = buildTacticalGraticuleGeoJSON();
assert.ok(graticule.features.length >= 35, `Expected >= 35 graticule grid features, got ${graticule.features.length}`);
const parallels = graticule.features.filter((f) => f.properties.kind === 'graticule-parallel');
const meridians = graticule.features.filter((f) => f.properties.kind === 'graticule-meridian');
const spokes = graticule.features.filter((f) => f.properties.kind === 'radial-spoke');
assert.ok(parallels.length >= 15, `Expected >= 15 latitude parallels, got ${parallels.length}`);
assert.ok(meridians.length >= 20, `Expected >= 20 longitude meridians, got ${meridians.length}`);
assert.equal(spokes.length, 8, `Expected exactly 8 radial azimuth spokes, got ${spokes.length}`);

console.log('ALL FRONTEND RADAR & BASEMAP REGRESSION TESTS PASSED (' + INITIAL_FLIGHTS.length + ' simulated aircraft verified)');
