import test from "node:test";
import assert from "node:assert/strict";

import {
  isSouthKoreaLabel,
  resolveSouthKoreaOption
} from "../shared/country-resolver.js";

test("허용한 South Korea 표기만 정확히 인식한다", () => {
  for (const label of [
    "South Korea",
    "Republic of Korea",
    "Korea, Republic of",
    "Korea (Republic of)",
    "Korea, South"
  ]) {
    assert.equal(isSouthKoreaLabel(label), true, label);
  }
  assert.equal(isSouthKoreaLabel("Korea"), false);
  assert.equal(isSouthKoreaLabel("North Korea"), false);
  assert.equal(isSouthKoreaLabel("Korea, Democratic People's Republic of"), false);
});

test("정확한 후보가 하나일 때만 자동 선택 대상으로 반환한다", () => {
  const south = { label: "South Korea", value: "KOR" };
  assert.equal(
    resolveSouthKoreaOption([{ label: "North Korea" }, south]),
    south
  );
  assert.equal(resolveSouthKoreaOption([{ label: "Korea" }]), null);
  assert.equal(
    resolveSouthKoreaOption([south, { label: "Republic of Korea" }]),
    null
  );
});
