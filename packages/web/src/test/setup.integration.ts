import "@testing-library/jest-dom/vitest";

import { beforeEach } from "vitest";

import { resetDb } from "@pt/api/webTestSupport";

import "./registerPolyfills";

beforeEach(resetDb);
