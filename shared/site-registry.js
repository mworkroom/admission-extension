const SITE_DEFINITIONS = Object.freeze([
  {
    key: "kcl",
    readerKey: "kcl",
    label: "KCL",
    universityName: "King's College London",
    hostnames: ["www.kcl.ac.uk", "kcl.ac.uk"],
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/study\/postgraduate-taught\/courses\/[^/]+\/requirements\/?$/.test(
          url.pathname
        )
      );
    }
  },
  {
    key: "soas",
    readerKey: "soas",
    label: "SOAS",
    universityName: "SOAS University of London",
    hostnames: ["www.soas.ac.uk", "soas.ac.uk"],
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/study\/find-course\/[^/]+\/?$/.test(url.pathname)
      );
    }
  },
  {
    key: "qmul",
    readerKey: "qmul",
    label: "QMUL",
    universityName: "Queen Mary University of London",
    hostnames: ["www.qmul.ac.uk", "qmul.ac.uk"],
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/postgraduate\/taught\/coursefinder\/courses\/[^/]+\/?$/.test(
          url.pathname
        )
      );
    }
  },
  {
    key: "ucl",
    readerKey: "generic",
    label: "UCL",
    universityName: "University College London",
    hostnames: ["www.ucl.ac.uk", "ucl.ac.uk"],
    autoSelectCountry: true,
    expandEnglishAccordion: true,
    captureVisaRequiredDeadline: true,
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/prospective-students\/graduate\/taught-degrees\/[^/]+\/?$/.test(
          url.pathname
        )
      );
    }
  },
  {
    key: "warwick",
    readerKey: "generic",
    label: "Warwick",
    universityName: "University of Warwick",
    hostnames: ["warwick.ac.uk", "www.warwick.ac.uk"],
    autoSelectCountry: true,
    koreanAcademicResultSelector: "#international-content",
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/study\/postgraduate\/courses\/[^/]+\/?$/.test(url.pathname)
      );
    }
  },
  {
    key: "sheffield",
    readerKey: "generic",
    label: "Sheffield",
    universityName: "University of Sheffield",
    hostnames: ["sheffield.ac.uk", "www.sheffield.ac.uk"],
    koreanAcademicRequirementsUrl:
      "https://sheffield.ac.uk/international/entry-requirements/south-korea",
    applicationFeeUrl:
      "https://sheffield.ac.uk/international/applying/postgraduate-taught",
    applicationDeadlineUrl:
      "https://sheffield.ac.uk/postgraduate/deadlines#September2026entry",
    cvGuidelineUrl:
      "https://sheffield.ac.uk/postgraduate/supporting#CurriculumvitaeCVresume",
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/postgraduate\/taught\/courses\/20\d{2}\/[^/]+\/?$/.test(
          url.pathname
        )
      );
    }
  },
  {
    key: "manchester",
    readerKey: "generic",
    label: "Manchester",
    universityName: "The University of Manchester",
    hostnames: ["www.manchester.ac.uk", "manchester.ac.uk"],
    koreanAcademicRequirementsUrl:
      "https://www.manchester.ac.uk/study/international/country-specific-information/south-korea/entry-requirements/#country-profile",
    koreanAcademicDefaultDegreeClass: "upper_second",
    additionalContentSelector: "div.text",
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/study\/masters\/courses\/list\/\d+\/[^/]+\/?$/.test(url.pathname)
      );
    }
  },
  {
    key: "manchester",
    readerKey: "manchester",
    label: "Manchester",
    universityName: "The University of Manchester",
    hostnames: ["www.alliancembs.manchester.ac.uk"],
    matches(url) {
      return (
        this.hostnames.includes(url.hostname.toLowerCase()) &&
        /^\/study\/masters\/[^/]+\/(?:overview|entry-requirements|application-and-selection|course-details|careers)\/?$/.test(
          url.pathname
        )
      );
    }
  }
]);

function createGenericSiteKey(hostname) {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "generic-site";
}

export function getSupportedSite(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return null;
    }

    const exactSite = SITE_DEFINITIONS.find((site) => site.matches(url));
    if (exactSite) {
      return {
        ...exactSite,
        generic: false
      };
    }

    const knownHostSite = SITE_DEFINITIONS.find((site) =>
      site.hostnames.includes(url.hostname.toLowerCase())
    );
    if (knownHostSite) {
      return {
        ...knownHostSite,
        readerKey: "generic",
        generic: true
      };
    }

    const hostname = url.hostname.toLowerCase();
    return {
      key: createGenericSiteKey(hostname),
      readerKey: "generic",
      label: hostname.replace(/^www\./, ""),
      universityName: "",
      hostnames: [hostname],
      generic: true,
      matches() {
        return false;
      }
    };
  } catch {
    return null;
  }
}

export function isSupportedCourseUrl(value) {
  return Boolean(getSupportedSite(value));
}

export { SITE_DEFINITIONS };
