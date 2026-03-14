import assert from "node:assert/strict";
import test from "node:test";
import { resolveOptionalPathEnv } from "../lib/env-path.ts";

test("resolveOptionalPathEnv falls back when the env var is blank", () => {
  assert.equal(resolveOptionalPathEnv("", "/tmp/openclaw"), "/tmp/openclaw");
});

test("resolveOptionalPathEnv falls back when the env var is missing", () => {
  assert.equal(resolveOptionalPathEnv(undefined, "/tmp/openclaw"), "/tmp/openclaw");
});

test("resolveOptionalPathEnv keeps a configured path", () => {
  assert.equal(resolveOptionalPathEnv("/workspaces/openclaw", "/tmp/openclaw"), "/workspaces/openclaw");
});
