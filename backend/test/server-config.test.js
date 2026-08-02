import assert from "node:assert/strict";
import { test } from "node:test";
import { getServerConfig } from "../src/server-config.js";

test("development server configuration uses safe local defaults", () => {
  assert.deepEqual(getServerConfig({}), {
    host: "127.0.0.1",
    port: 4000,
    production: false,
    seedDemo: false,
    trustProxy: false,
  });
});

test("production server configuration is reachable by container ingress", () => {
  assert.deepEqual(
    getServerConfig({
      NODE_ENV: "production",
      PORT: "8080",
      JOBFINDER_TRUST_PROXY: "true",
    }),
    {
      host: "0.0.0.0",
      port: 8080,
      production: true,
      seedDemo: false,
      trustProxy: true,
    },
  );
});

test("explicit host and demo settings are respected", () => {
  const config = getServerConfig({
    HOST: "10.0.0.4",
    JOBFINDER_SEED_DEMO: "yes",
  });
  assert.equal(config.host, "10.0.0.4");
  assert.equal(config.seedDemo, true);
});

test("invalid ports and empty hosts are rejected", () => {
  assert.throws(() => getServerConfig({ PORT: "0" }), /PORT/);
  assert.throws(() => getServerConfig({ PORT: "4000.5" }), /PORT/);
  assert.throws(() => getServerConfig({ PORT: "invalid" }), /PORT/);
  assert.throws(() => getServerConfig({ HOST: "  " }), /HOST/);
});

test("production cannot seed private demo accounts", () => {
  assert.throws(
    () =>
      getServerConfig({
        NODE_ENV: "production",
        JOBFINDER_SEED_DEMO: "true",
      }),
    /JOBFINDER_SEED_DEMO/,
  );
});
