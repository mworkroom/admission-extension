export const SOUTH_KOREA_ALIASES = Object.freeze([
  "south korea",
  "republic of korea",
  "korea republic of",
  "korea (republic of)",
  "korea south"
]);

export function normalizeCountryLabel(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSouthKoreaLabel(value) {
  return SOUTH_KOREA_ALIASES.includes(normalizeCountryLabel(value));
}

export function resolveSouthKoreaOption(options) {
  const matches = (options ?? []).filter((option) =>
    isSouthKoreaLabel(option?.label ?? option?.text ?? "")
  );
  return matches.length === 1 ? matches[0] : null;
}
