import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../manifest.json", import.meta.url);

test("Manifest V3와 Chrome 116 이상을 사용한다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.equal(manifest.background.service_worker, "service-worker.js");
  assert.equal(manifest.side_panel.default_path, "sidepanel/sidepanel.html");
  assert.equal("default_popup" in manifest.action, false);
  assert.equal(manifest.version, "0.14.0");
});

test("Phase 1은 activeTab 기반 추출에 필요한 최소 권한만 요청한다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.deepEqual(manifest.permissions, [
    "activeTab",
    "scripting",
    "sidePanel",
    "storage"
  ]);
  assert.equal("host_permissions" in manifest, false);
  assert.equal(manifest.permissions.includes("tabs"), false);
  assert.equal(manifest.permissions.includes("downloads"), false);
  assert.equal(manifest.permissions.includes("cookies"), false);
});
