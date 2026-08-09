import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPassword } from "../src/auth.js";
import { createDatabase } from "../src/db.js";
import {
  getDemoAccountConfig,
  getServerConfig,
} from "../src/server-config.js";

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

test("development provides the public thesis demo accounts", () => {
  const environment = { JOBFINDER_SEED_DEMO: "true" };
  assert.deepEqual(
    getDemoAccountConfig(getServerConfig(environment), environment),
    {
      employerEmail: "employer@demo.com",
      jobSeekerEmail: "jobfinder@demo.com",
      pesoLguEmail: undefined,
      password: "12345678",
    },
  );
});

test("a fresh development database can use both public demo accounts", () => {
  const environment = { JOBFINDER_SEED_DEMO: "true" };
  const config = getServerConfig(environment);
  const demoAccounts = getDemoAccountConfig(config, environment);
  const db = createDatabase(":memory:", {
    seedDemo: config.seedDemo,
    demoAccounts,
  });

  try {
    const users = db
      .prepare(
        "SELECT email, password_hash, role FROM users ORDER BY role, email",
      )
      .all();
    assert.deepEqual(
      users.map(({ email, role }) => ({ email, role })),
      [
        { email: "employer@demo.com", role: "employer" },
        { email: "jobfinder@demo.com", role: "job-seeker" },
      ],
    );
    assert.equal(
      users.every(({ password_hash }) =>
        verifyPassword("12345678", password_hash),
      ),
      true,
    );
  } finally {
    db.close();
  }
});

test("configured demo accounts override development defaults", () => {
  const environment = {
    JOBFINDER_SEED_DEMO: "true",
    JOBFINDER_DEMO_EMPLOYER_EMAIL: "owner@example.com",
    JOBFINDER_DEMO_JOB_SEEKER_EMAIL: "seeker@example.com",
    JOBFINDER_DEMO_PESO_LGU_EMAIL: "reviewer@example.gov",
    JOBFINDER_DEMO_PASSWORD: "private-password",
  };
  assert.deepEqual(
    getDemoAccountConfig(getServerConfig(environment), environment),
    {
      employerEmail: "owner@example.com",
      jobSeekerEmail: "seeker@example.com",
      pesoLguEmail: "reviewer@example.gov",
      password: "private-password",
    },
  );
});

test("disabled and production configurations expose no demo accounts", () => {
  const development = {};
  const production = { NODE_ENV: "production" };
  assert.equal(
    getDemoAccountConfig(getServerConfig(development), development),
    null,
  );
  assert.equal(
    getDemoAccountConfig(getServerConfig(production), production),
    null,
  );
});
