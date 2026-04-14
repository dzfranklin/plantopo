import { describe, expect, it } from "vitest";

import { type GeocodingFeature, buildLabel } from "./geocoder.service.js";

type Props = GeocodingFeature["properties"];

const SCALD_LAW_DRIVE: Props = {
  type: "house",
  osm_type: "N",
  osm_id: 7022247199,
  osm_key: "place",
  osm_value: "house",
  housenumber: "15",
  street: "Scald Law Drive",
  locality: "Polofields",
  district: "Colinton",
  city: "Edinburgh",
  state: "Scotland",
  country: "United Kingdom",
  postcode: "EH13 0FN",
  countrycode: "GB",
};

const BONALY_ROAD: Props = {
  type: "house",
  osm_type: "R",
  osm_id: 3432353,
  osm_key: "building",
  osm_value: "school",
  housenumber: "57",
  street: "Bonaly Road",
  locality: "Bonaly",
  district: "Colinton",
  city: "Edinburgh",
  state: "Scotland",
  country: "United Kingdom",
  postcode: "EH13 0FJ",
  countrycode: "GB",
};

const HOWDEN_BURN: Props = {
  type: "other",
  osm_type: "W",
  osm_id: 586893459,
  osm_key: "waterway",
  osm_value: "stream",
  name: "Howden Burn",
  locality: "Bonaly",
  city: "Edinburgh",
  state: "Scotland",
  country: "United Kingdom",
  postcode: "EH13 9QN",
  countrycode: "GB",
};

const LOCH_COIRE_AN_LOCHAIN: Props = {
  type: "other",
  osm_type: "W",
  osm_id: 31291945,
  osm_key: "natural",
  osm_value: "water",
  name: "Loch Coire an Lochain",
  county: "Highland",
  state: "Scotland",
  country: "United Kingdom",
  countrycode: "GB",
};

const ALLERMUIR_HILL: Props = {
  type: "other",
  osm_type: "N",
  osm_id: 243914880,
  osm_key: "natural",
  osm_value: "peak",
  name: "Allermuir Hill",
  city: "Edinburgh",
  state: "Scotland",
  country: "United Kingdom",
  postcode: "EH13 9QR",
  countrycode: "GB",
};

describe("buildLabel", () => {
  it("combines housenumber and street for a house with a city", () => {
    expect(buildLabel(SCALD_LAW_DRIVE)).toBe("15 Scald Law Drive, Edinburgh");
  });

  it("combines housenumber and street for a building with a city", () => {
    expect(buildLabel(BONALY_ROAD)).toBe("57 Bonaly Road, Edinburgh");
  });

  it("uses name and city for a named waterway", () => {
    expect(buildLabel(HOWDEN_BURN)).toBe("Howden Burn, Edinburgh");
  });

  it("falls back to state when there is no city", () => {
    expect(buildLabel(LOCH_COIRE_AN_LOCHAIN)).toBe(
      "Loch Coire an Lochain, Scotland",
    );
  });

  it("uses name and city for a named peak", () => {
    expect(buildLabel(ALLERMUIR_HILL)).toBe("Allermuir Hill, Edinburgh");
  });
});
