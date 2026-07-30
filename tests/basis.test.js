import test from "node:test";
import assert from "node:assert/strict";

import {
  createBasis,
  createDefaultBasis,
  formatBasis,
  isValidBasis,
  normalizeBasis
} from "../shared/basis.js";
import {
  loadAppState,
  saveBasis,
  STORAGE_KEYS,
  UI_VERSION
} from "../shared/storage.js";

const FIXED_DATE = new Date("2026-07-30T00:00:00.000Z");

test("기본 앱 기준은 Phase 0 계획과 일치한다", () => {
  const basis = createDefaultBasis(FIXED_DATE);

  assert.deepEqual(basis, {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international",
    updatedAt: "2026-07-30T00:00:00.000Z"
  });
  assert.equal(isValidBasis(basis), true);
  assert.deepEqual(formatBasis(basis), {
    cycleAndIntake: "2026/27 · 2026년 9월",
    modeAndFee: "Full-time · International"
  });
});

test("연속되지 않는 학년도와 범위 밖 입학 월을 거부한다", () => {
  assert.throws(
    () =>
      createBasis(
        {
          academicCycle: "2026/28",
          intakeMonth: 9,
          intakeYear: 2026,
          studyMode: "full-time",
          feeStatus: "international"
        },
        FIXED_DATE
      ),
    TypeError
  );

  assert.throws(
    () =>
      createBasis(
        {
          academicCycle: "2026/27",
          intakeMonth: 13,
          intakeYear: 2026,
          studyMode: "full-time",
          feeStatus: "international"
        },
        FIXED_DATE
      ),
    TypeError
  );
});

test("손상된 저장값은 기본값으로 복구한다", () => {
  const recovered = normalizeBasis(
    {
      academicCycle: "잘못된 값",
      intakeMonth: 0
    },
    FIXED_DATE
  );

  assert.deepEqual(recovered, createDefaultBasis(FIXED_DATE));
});

test("저장값이 없으면 기본 기준과 UI 버전을 로컬 저장소에 기록한다", async () => {
  const writes = [];
  const storage = {
    async get() {
      return {};
    },
    async set(value) {
      writes.push(value);
    }
  };

  const state = await loadAppState(storage, FIXED_DATE);

  assert.equal(state.recovered, false);
  assert.equal(state.persisted, true);
  assert.deepEqual(writes, [
    {
      [STORAGE_KEYS.basis]: createDefaultBasis(FIXED_DATE),
      [STORAGE_KEYS.uiVersion]: UI_VERSION
    }
  ]);
});

test("손상된 저장 기준은 기본값으로 복구하고 복구 상태를 알린다", async () => {
  const writes = [];
  const storage = {
    async get() {
      return {
        [STORAGE_KEYS.basis]: {
          academicCycle: "2026/99",
          intakeMonth: 13
        },
        [STORAGE_KEYS.uiVersion]: UI_VERSION
      };
    },
    async set(value) {
      writes.push(value);
    }
  };

  const state = await loadAppState(storage, FIXED_DATE);

  assert.equal(state.recovered, true);
  assert.equal(state.persisted, true);
  assert.deepEqual(state.basis, createDefaultBasis(FIXED_DATE));
  assert.equal(writes.length, 1);
});

test("저장 실패 시 실패 상태를 반환하고 기준 저장은 오류를 전달한다", async () => {
  const storage = {
    async get() {
      throw new Error("storage unavailable");
    },
    async set() {
      throw new Error("storage unavailable");
    }
  };

  const state = await loadAppState(storage, FIXED_DATE);
  assert.equal(state.persisted, false);
  assert.equal(state.recovered, false);
  assert.deepEqual(state.basis, createDefaultBasis(FIXED_DATE));

  await assert.rejects(
    saveBasis(createDefaultBasis(FIXED_DATE), storage),
    /storage unavailable/
  );
});

test("UI 버전 보정 저장이 실패해도 유효한 기존 기준은 유지한다", async () => {
  const existingBasis = createBasis(
    {
      academicCycle: "2027/28",
      intakeMonth: 1,
      intakeYear: 2027,
      studyMode: "part-time",
      feeStatus: "home"
    },
    FIXED_DATE
  );
  const storage = {
    async get() {
      return {
        [STORAGE_KEYS.basis]: existingBasis,
        [STORAGE_KEYS.uiVersion]: 0
      };
    },
    async set() {
      throw new Error("storage unavailable");
    }
  };

  const state = await loadAppState(storage, FIXED_DATE);

  assert.equal(state.persisted, false);
  assert.equal(state.recovered, false);
  assert.deepEqual(state.basis, existingBasis);
});
