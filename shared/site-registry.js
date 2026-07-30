const SITE_DEFINITIONS = Object.freeze([
  {
    key: "kcl",
    label: "KCL",
    universityName: "King's College London",
    matches(url) {
      return (
        ["www.kcl.ac.uk", "kcl.ac.uk"].includes(url.hostname.toLowerCase()) &&
        /^\/study\/postgraduate-taught\/courses\/[^/]+\/requirements\/?$/.test(
          url.pathname
        )
      );
    }
  },
  {
    key: "soas",
    label: "SOAS",
    universityName: "SOAS University of London",
    matches(url) {
      return (
        ["www.soas.ac.uk", "soas.ac.uk"].includes(url.hostname.toLowerCase()) &&
        /^\/study\/find-course\/[^/]+\/?$/.test(url.pathname)
      );
    }
  },
  {
    key: "qmul",
    label: "QMUL",
    universityName: "Queen Mary University of London",
    matches(url) {
      return (
        ["www.qmul.ac.uk", "qmul.ac.uk"].includes(url.hostname.toLowerCase()) &&
        /^\/postgraduate\/taught\/coursefinder\/courses\/[^/]+\/?$/.test(
          url.pathname
        )
      );
    }
  }
]);

export function getSupportedSite(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return null;
    }
    return SITE_DEFINITIONS.find((site) => site.matches(url)) ?? null;
  } catch {
    return null;
  }
}

export function isSupportedCourseUrl(value) {
  return Boolean(getSupportedSite(value));
}

export { SITE_DEFINITIONS };
