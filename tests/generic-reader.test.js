import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readGenericPage } from "../content/read-generic-page.js";
import { parseCourseSnapshot } from "../shared/course-parser.js";

class FakeNode {
  constructor({
    tag = "div",
    text = "",
    children = [],
    next = null,
    closestMap = {},
    href = "",
    value = "",
    attributes = {}
  } = {}) {
    this.tagName = tag.toUpperCase();
    this.innerText = text;
    this.textContent = text;
    this.children = children;
    this.nextElementSibling = next;
    this.closestMap = closestMap;
    this.href = href;
    this.value = value;
    this.attributes = attributes;
  }

  querySelectorAll(selector) {
    if (selector === "h3,h4,h5,h6") {
      return this.children.filter((node) => /^H[3-6]$/.test(node.tagName));
    }
    if (selector === "table") {
      return this.children.filter((node) => node.tagName === "TABLE");
    }
    if (selector === "tr") {
      return this.children.filter((node) => node.tagName === "TR");
    }
    if (selector === "th") {
      return this.children.filter((node) => node.tagName === "TH");
    }
    if (selector === "th,td") {
      return this.children.filter((node) => /^(?:TH|TD)$/.test(node.tagName));
    }
    if (selector === "option") {
      return this.children.filter((node) => node.tagName === "OPTION");
    }
    if (selector === "li") {
      return this.children.filter((node) => node.tagName === "LI");
    }
    if (selector === "p,li,dd,tr") {
      return this.children.filter((node) => /^(?:P|LI|DD|TR)$/.test(node.tagName));
    }
    if (selector === "select") {
      return this.children.filter((node) => node.tagName === "SELECT");
    }
    return [];
  }

  querySelector(selector) {
    if (selector === "h1") {
      return this.children.find((node) => node.tagName === "H1") || null;
    }
    return null;
  }

  closest(selector) {
    return this.closestMap[selector] || null;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  dispatchEvent() {}

  click() {
    this.clicked = true;
  }
}

class EntryFixtureNode {
  constructor({
    tag = "div",
    text = "",
    id = "",
    className = "",
    children = [],
    attributes = {},
    value = ""
  } = {}) {
    this.tagName = tag.toUpperCase();
    this._text = text;
    this.id = id;
    this.className = className;
    this.children = children;
    this.parentElement = null;
    this.nextElementSibling = null;
    this.href = "";
    this.value = value;
    this.attributes = attributes;
    children.forEach((child, index) => {
      child.parentElement = this;
      child.nextElementSibling = children[index + 1] || null;
    });
  }

  get innerText() {
    return [this._text, ...this.children.map((child) => child.innerText)]
      .filter(Boolean)
      .join(" ");
  }

  get textContent() {
    return this.innerText;
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  matchesSelector(selector) {
    const value = selector.trim();
    if (/^[a-z][a-z0-9]*$/i.test(value)) {
      return this.tagName === value.toUpperCase();
    }
    if (value === "[role='alert']") {
      return this.attributes.role === "alert";
    }
    if (value === "a[href]") {
      return this.tagName === "A" && Boolean(this.href);
    }
    if (value === "script[type='application/ld+json']") {
      return false;
    }
    if (value === "div.card") {
      return this.tagName === "DIV" && this.className.split(/\s+/).includes("card");
    }
    if (value === "[role='group']") {
      return this.attributes.role === "group";
    }
    if (value === "[role='tab']") {
      return this.attributes.role === "tab";
    }
    if (value === "[role='tabpanel']") {
      return this.attributes.role === "tabpanel";
    }
    const classContains = value.match(/^\[class\*='([^']+)'\]$/);
    if (classContains) {
      return this.className.includes(classContains[1]);
    }
    if (value === "[class*='accordion']") {
      return this.className.includes("accordion");
    }
    if (value === "[class*='toggle']") {
      return this.className.includes("toggle");
    }
    return false;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",");
    return this.descendants().filter((node) =>
      selectors.some((item) => node.matchesSelector(item))
    );
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    const selectors = selector.split(",");
    let node = this;
    while (node) {
      if (selectors.some((item) => node.matchesSelector(item))) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  contains(target) {
    return this === target || this.descendants().includes(target);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  click() {
    this.clicked = true;
  }

  dispatchEvent(event) {
    this.dispatchedEvents ??= [];
    this.dispatchedEvents.push(event.type);
  }
}

const entryNode = (tag, text = "", options = {}) =>
  new EntryFixtureNode({ tag, text, ...options });

const tuitionV2Fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/tuition-fee-dom-v2.json", import.meta.url),
    "utf8"
  )
);

const tuitionFixtureNode = (definition) =>
  entryNode(definition.tag, definition.text || "", {
    id: definition.id || "",
    className: definition.className || "",
    attributes: definition.attributes || {},
    value: definition.value || "",
    children: (definition.children || []).map(tuitionFixtureNode)
  });

const collectFixtureNodes = (node) => [
  ...node.children,
  ...node.children.flatMap(collectFixtureNodes)
];

async function readEntryFixture(school, courseChildren) {
  const courseHeading = entryNode("h1", school + " test course");
  const root = entryNode("main", "", {
    children: [courseHeading, ...courseChildren]
  });
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: school + " test course",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://" + school.toLowerCase() + ".example.test/course",
    hostname: school.toLowerCase() + ".example.test",
    pathname: "/course"
  };

  try {
    const payload = await readGenericPage({
      siteKey: school.toLowerCase(),
      universityName: school,
      basis: { academicCycle: "2026/27" }
    });
    return payload.entryRequirements;
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
}

async function readMoneyFixture(school, blocks) {
  const courseHeading = new FakeNode({ tag: "h1", text: `${school} test MSc` });
  const paragraphs = blocks.map((text) => new FakeNode({ tag: "p", text }));
  const root = new FakeNode({ children: [courseHeading, ...paragraphs] });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "p,li,dd,tr") return paragraphs;
    if (selector === "p") return paragraphs;
    return [];
  };
  root.querySelector = (selector) => selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: `${school} test MSc`,
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: `https://${school.toLowerCase()}.example.test/course`,
    hostname: `${school.toLowerCase()}.example.test`,
    pathname: "/course"
  };

  const basis = {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  };
  try {
    const payload = await readGenericPage({
      siteKey: school.toLowerCase(),
      universityName: school,
      basis
    });
    return { payload, analysis: parseCourseSnapshot(payload, basis) };
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
}

test("Tuition Fee v2는 실제 DOM 관계를 4개 핵심 extractor 계열로 보존한다", async () => {
  const basis = {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  };

  for (const fixture of tuitionV2Fixtures) {
    const courseHeading = entryNode("h1", `${fixture.name} MSc`);
    const fixtureRoot = tuitionFixtureNode(fixture.dom);
    const root = entryNode("main", "", {
      children: [courseHeading, fixtureRoot]
    });
    const previousDocument = globalThis.document;
    const previousLocation = globalThis.location;
    globalThis.document = {
      title: `${fixture.name} MSc`,
      body: root,
      querySelector: (selector) =>
        selector === "main, [role='main']" ? root : null,
      querySelectorAll: () => []
    };
    globalThis.location = {
      href: `https://${fixture.name.toLowerCase().replace(/[^a-z]+/g, "-")}.example.test/course`,
      hostname: `${fixture.name.toLowerCase().replace(/[^a-z]+/g, "-")}.example.test`,
      pathname: "/course"
    };

    try {
      const payload = await readGenericPage({
        siteKey: fixture.name,
        universityName: fixture.name,
        basis
      });
      const analysis = parseCourseSnapshot(payload, basis);
      const tuition = analysis.fields.find((field) => field.key === "tuitionFee");

      assert.equal(payload.tuitionExtraction.version, 2, fixture.name);
      assert.ok(
        payload.tuitionExtraction.families.includes(fixture.family),
        `${fixture.name}: ${fixture.family} ${JSON.stringify({ tuition: payload.tuitionFeeCandidates, money: payload.moneyCandidates })}`
      );
      if (fixture.expected) {
        assert.equal(
          tuition.status,
          "found",
          `${fixture.name}: ${JSON.stringify(payload.tuitionFeeCandidates)}`
        );
        assert.equal(tuition.value, fixture.expected, fixture.name);
      } else {
        assert.equal(tuition.status, fixture.status, fixture.name);
        assert.equal(tuition.reasonCode, fixture.reasonCode, fixture.name);
      }
      if (fixture.adapter) {
        assert.equal(
          payload.tuitionExtraction.pageAdapters[fixture.adapter],
          true,
          fixture.name
        );
      }
      if (fixture.adapter === "audienceSelection") {
        const internationalTab = collectFixtureNodes(root).find(
          (node) =>
            node.tagName === "BUTTON" &&
            /^International fees$/i.test(node.innerText)
        );
        const countrySelect = collectFixtureNodes(root).find(
          (node) =>
            node.tagName === "SELECT" &&
            /fee|cost|tuition/i.test(`${node.id} ${node.className}`)
        );
        assert.ok(
          internationalTab?.clicked || countrySelect?.value === "South Korea",
          fixture.name
        );
      }
      if (fixture.name.includes("Southampton")) {
        assert.deepEqual(
          payload.tuitionFeeCandidates.map((candidate) => candidate.value),
          ["£35,000"]
        );
        assert.ok(
          payload.moneyCandidates.some(
            (candidate) =>
              candidate.category === "deposit" && candidate.value === "£2,000"
          )
        );
        assert.ok(
          payload.moneyCandidates.some(
            (candidate) =>
              candidate.category === "scholarship" &&
              candidate.value === "£5,000"
          )
        );
      }
      if (fixture.name.includes("Manchester ordered prefix")) {
        assert.deepEqual(
          payload.tuitionFeeCandidates.map((candidate) => [
            candidate.value,
            candidate.feeStatus
          ]),
          [
            ["£38,400", "international"],
            ["£16,300", "home"]
          ]
        );
      }
      if (fixture.name.includes("Sheffield fee boxes")) {
        assert.ok(
          payload.moneyCandidates.some(
            (candidate) =>
              candidate.value === "£2,500" &&
              candidate.category === "scholarship"
          )
        );
        assert.ok(
          !payload.tuitionFeeCandidates.some(
            (candidate) => candidate.value === "£2,500"
          )
        );
      }
      if (fixture.name.includes("UCL class-labelled")) {
        assert.deepEqual(
          payload.tuitionFeeCandidates.map((candidate) => [
            candidate.value,
            candidate.studyMode
          ]),
          [
            ["£35,400", "full-time"],
            ["£17,700", "part-time"]
          ]
        );
      }
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
      if (previousLocation === undefined) delete globalThis.location;
      else globalThis.location = previousLocation;
    }
  }
});

test("Generic Entry v2는 10개 대학 구조에서 학력 범위 후보를 선택한다", async () => {
  const fixtures = [
    {
      school: "Manchester",
      nodes: () => [
        entryNode("section", "", {
          id: "entry-requirements",
          children: [
            entryNode("h2", "Entry requirements"),
            entryNode("h3", "Academic entry qualification overview"),
            entryNode("p", "An Upper Second Class UK Honours degree or international equivalent in engineering."),
            entryNode("h3", "English language"),
            entryNode("p", "IELTS 7.0 overall.")
          ]
        })
      ],
      include: /Upper Second Class/,
      exclude: /IELTS/
    },
    {
      school: "Edinburgh",
      nodes: () => {
        const card = entryNode("div", "", {
          className: "card",
          children: [
            entryNode("h4", "Qualifications"),
            entryNode("p", "Entrance is strongly competitive."),
            entryNode("h4", "Academic requirements"),
            entryNode("p", "A UK first-class or 2:1 honours degree, or an equivalent overseas qualification."),
            entryNode("h4", "Supporting your application"),
            entryNode("p", "Relevant work experience may support your application.")
          ]
        });
        return [
          entryNode("div", "", {
            id: "entry-requirements",
            children: [
              entryNode("h2", "Entry requirements"),
              entryNode("div", "", { children: [card] })
            ]
          })
        ];
      },
      include: /first-class or 2:1/,
      exclude: /Relevant work experience/
    },
    {
      school: "Leeds",
      nodes: () => [
        entryNode("section", "", {
          id: "section-applying",
          children: [
            entryNode("h3", "Entry requirements"),
            entryNode("p", "A Bachelor degree with a 2:1 (hons) or equivalent in a related subject."),
            entryNode("p", "International qualifications"),
            entryNode("h4", "English language requirements"),
            entryNode("p", "IELTS 6.5 overall.")
          ]
        })
      ],
      include: /Bachelor degree/,
      exclude: /IELTS/
    },
    {
      school: "Birmingham",
      nodes: () => [
        entryNode("div", "", {
          id: "entry-requirements",
          children: [
            entryNode("div", "", {
              children: [entryNode("span", "", {
                children: [entryNode("h2", "Entry requirements")]
              })]
            }),
            entryNode("div", "Applications are reviewed by the Admissions Tutor."),
            entryNode("section", "A 2:1 Honours degree or postgraduate diploma from a UK university or overseas equivalent."),
            entryNode("div", "English language requirements IELTS 6.5.")
          ]
        })
      ],
      include: /2:1 Honours degree/,
      exclude: /IELTS/
    },
    {
      school: "Nottingham",
      nodes: () => [
        entryNode("div", "", {
          id: "EntryRequirements",
          children: [
            entryNode("h2", "Entry requirements"),
            entryNode("div", "The requirements apply to 2027 entry. Undergraduate degree 2:1 or international equivalent in any discipline.")
          ]
        })
      ],
      include: /Undergraduate degree 2:1/,
      exclude: /English language/
    },
    {
      school: "Bristol",
      nodes: () => [
        entryNode("section", "", {
          id: "entry-requirements",
          children: [
            entryNode("div", "", {
              children: [
                entryNode("div", "", {
                  children: [entryNode("h2", "Entry requirements")]
                }),
                entryNode("p", "You will typically need an upper second-class honours degree or an international equivalent in any discipline."),
                entryNode("p", "We may make an aspirational offer if interim grades are slightly lower."),
                entryNode("p", "Relevant work experience may support a lower achieved grade. If you have at least one of the following, please include your CV when you apply."),
                entryNode("ul", "Five years of relevant work experience."),
                entryNode("div", "Admissions Statement Read the application process and supporting documents.")
              ]
            })
          ]
        })
      ],
      include: /upper second-class honours degree/,
      exclude: /CV|Admissions Statement/
    },
    {
      school: "York",
      nodes: () => [
        entryNode("div", "", {
          id: "entry",
          children: [
            entryNode("h2", "Entry requirements"),
            entryNode("div", "Qualification Typical offer Undergraduate degree 2.2 in Finance, Accounting or Maths. Relevant professional qualifications may also be considered."),
            entryNode("h3", "English language"),
            entryNode("p", "IELTS 6.5 overall.")
          ]
        })
      ],
      include: /Undergraduate degree 2.2/,
      exclude: /IELTS/
    },
    {
      school: "Loughborough",
      nodes: () => [
        entryNode("div", "", {
          className: "degree-section degree-section--entry",
          children: [
            entryNode("h2", "ENTRY REQUIREMENTS"),
            entryNode("div", "", {
              children: [
                entryNode("p", "Choose a country for equivalent qualifications."),
                entryNode("h3", "Entry requirements for United Kingdom"),
                entryNode("p", "A 2:2 honours degree or equivalent international qualification in science or engineering."),
                entryNode("h3", "Afghanistan"),
                entryNode("p", "Country-specific qualification."),
                entryNode("select", "Afghanistan Albania Australia Bangladesh Canada China France Germany India Japan South Korea Spain Vietnam Zimbabwe")
              ]
            })
          ]
        })
      ],
      include: /2:2 honours degree/,
      exclude: /Afghanistan|South Korea/
    },
    {
      school: "Southampton",
      nodes: () => [
        entryNode("section", "", {
          id: "entry",
          children: [
            entryNode("h2", "Entry requirements"),
            entryNode("section", "You’ll need a 2:1 degree in electrical or electronic engineering and relevant advanced modules."),
            entryNode("section", "English language requirements IELTS score requirements."),
            entryNode("section", "Students who have studied in China must meet separate grades.")
          ]
        })
      ],
      include: /2:1 degree/,
      exclude: /IELTS|China/
    },
    {
      school: "Exeter",
      nodes: () => [
        entryNode("section", "", {
          id: "entry-requirements",
          children: [
            entryNode("h2", "Entry requirements"),
            entryNode("p", "A 2:2 degree with honours in Accounting, Finance, Economics, Maths or a related discipline."),
            entryNode("p", "Mathematics modules may include Algebra, Calculus, Statistics or Probability."),
            entryNode("div", "Please also see our guidance on essential documentation required for an initial decision. Entry requirements for international students English language requirements.")
          ]
        })
      ],
      include: /2:2 degree with honours/,
      exclude: /essential documentation|English language/
    }
  ];

  for (const fixture of fixtures) {
    const entry = await readEntryFixture(fixture.school, fixture.nodes());
    assert.match(entry, fixture.include, fixture.school);
    assert.doesNotMatch(entry, fixture.exclude, fixture.school);
  }
});

test("generic reader는 Entry requirements 아코디언에서 학력 블록만 읽는다", async () => {
  const qualificationsCard = new FakeNode({
    text:
      "Qualifications Entrance to our MSc programmes is strongly competitive. " +
      "Academic requirements You will need a UK first-class or 2:1 honours degree " +
      "in any subject, or an equivalent overseas qualification. Supporting your " +
      "application Relevant work experience is not required."
  });
  const qualificationsHeading = new FakeNode({
    tag: "h4",
    text: "Qualifications",
    closestMap: {
      "div.card, section, article, [role='group']": qualificationsCard
    }
  });
  const internationalHeading = new FakeNode({
    tag: "h4",
    text: "International qualifications"
  });
  const region = new FakeNode({
    children: [qualificationsHeading, internationalHeading]
  });
  const entryHeading = new FakeNode({
    tag: "h2",
    text: "Entry requirements",
    next: region
  });
  const courseHeading = new FakeNode({ tag: "h1", text: "Marketing MSc" });
  const root = new FakeNode({ children: [courseHeading, entryHeading] });
  root.querySelectorAll = (selector) =>
    selector === "h1,h2,h3,h4,h5,h6"
      ? [courseHeading, entryHeading, qualificationsHeading, internationalHeading]
      : [];
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Marketing MSc - test",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://example.test/programme",
    hostname: "example.test",
    pathname: "/programme"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "example",
      universityName: "Example University",
      basis: { academicCycle: "2026/27" }
    });

    assert.match(payload.entryRequirements, /2:1/);
    assert.doesNotMatch(payload.entryRequirements, /Australia/);
    assert.doesNotMatch(payload.entryRequirements, /2027\/28/);
    assert.doesNotMatch(payload.entryRequirements, /Relevant work experience/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("CSV 13개 학교 금액 문맥은 학비·지원비·보증금·장학금·기타를 분리한다", async () => {
  const fixtures = [
    {
      school: "Manchester",
      blocks: [
        "Tuition fees 2026/27: UK £16,300; International £38,400.",
        "International applicants must pay a CAS deposit of £2,500.",
        "The University allocates £300,000 in funding every year."
      ],
      tuition: "£38,400",
      classified: { deposit: "£2,500", scholarship: "£300,000" }
    },
    {
      school: "UCL",
      blocks: [
        "International students Tuition fees (2026/27) £50,600.",
        "There is an application processing fee of £90 for online applications.",
        "Additional equipment costs may range from £800 to £1,500."
      ],
      tuition: "£50,600",
      applicationFee: "£90",
      classified: { other: "£800" }
    },
    {
      school: "Edinburgh",
      blocks: [
        "Programme tuition fees 2026/27: Scotland £24,800 and International / EU £36,310.",
        "The deposit for this programme is £2,500.",
        "A non-refundable application fee of £60 is payable.",
        "Living costs are estimated at £18,504 each year."
      ],
      tuition: "£36,310",
      applicationFee: "£60",
      classified: { deposit: "£2,500", other: "£18,504" }
    },
    {
      school: "Leeds",
      blocks: [
        "Tuition fees for 2026/27 are UK £18,750 and International £35,500."
      ],
      tuition: "£35,500"
    },
    {
      school: "Warwick",
      blocks: [
        "Accounting and Financial Management MSc full-time tuition fees 2026-27: Home £35,080 and Overseas £43,580."
      ],
      tuition: "£43,580"
    },
    {
      school: "Birmingham",
      blocks: [
        "South Korea £35,460. We charge an annual tuition fee. Fees for September 2026 and January 2027 entry are above.",
        "Scholarships include awards up to £25,000 and £10,000.",
        "We have put more than £33 million into student support and scholarships."
      ],
      tuition: "£35,460",
      classified: { scholarship: "£25,000" }
    },
    {
      school: "Nottingham",
      blocks: [
        "Tuition fees 2026/27: UK £17,300; International £33,800."
      ],
      tuition: "£33,800"
    },
    {
      school: "Bristol",
      blocks: [
        "2026/27 tuition fees per year: Home £18,500; Overseas £33,900."
      ],
      tuition: "£33,900"
    },
    {
      school: "York",
      blocks: [
        "Full-time tuition fees 2026/27: Home £17,500; International/EU £34,500."
      ],
      tuition: "£34,500"
    },
    {
      school: "Loughborough",
      blocks: [
        "2026-27 tuition fees: UK £13,700; International £30,900.",
        "2027-28 tuition fees: UK £14,000; International £31,750.",
        "Students use STEMLab, a £17,000,000 investment in facilities."
      ],
      tuition: "£30,900",
      classified: { other: "£17,000,000" }
    },
    {
      school: "Sheffield",
      blocks: [
        "2026-27 entry tuition fees: Home £13,155; Overseas £26,320.",
        "Alumni can receive a scholarship discount of up to £2,500."
      ],
      tuition: "£26,320",
      classified: { scholarship: "£2,500" }
    },
    {
      school: "Southampton",
      blocks: [
        "For entry academic year 2026 to 2027, tuition fees are UK £11,500 and EU and international £35,000.",
        "International students pay a deposit of £2,000.",
        "A scholarship of £5,000 is available.",
        "The average professional salary is £50,000."
      ],
      tuition: "£35,000",
      classified: { deposit: "£2,000", scholarship: "£5,000", other: "£50,000" }
    },
    {
      school: "Exeter",
      blocks: [
        "2026/27 entry UK fees per year: £19,900 full-time. International fees per year: £32,600 full-time.",
        "The University offers £7,000,000 in scholarships for international students."
      ],
      tuition: "£32,600",
      classified: { scholarship: "£7,000,000" }
    }
  ];

  for (const fixture of fixtures) {
    const { payload, analysis } = await readMoneyFixture(
      fixture.school,
      fixture.blocks
    );
    const tuitionField = analysis.fields.find(
      (field) => field.key === "tuitionFee"
    );
    assert.equal(tuitionField.value, fixture.tuition, fixture.school);
    assert.equal(tuitionField.status, "found", fixture.school);
    if (fixture.applicationFee) {
      assert.equal(
        payload.applicationFeeCandidates[0]?.value,
        fixture.applicationFee,
        `${fixture.school} application fee`
      );
    }
    for (const [category, value] of Object.entries(fixture.classified || {})) {
      assert.ok(
        payload.moneyCandidates.some(
          (candidate) =>
            candidate.category === category && candidate.value === value
        ),
        `${fixture.school} ${category} ${value}`
      );
      assert.ok(
        !payload.tuitionFeeCandidates.some(
          (candidate) => candidate.value === value
        ),
        `${fixture.school} excludes ${category} from tuition`
      );
    }
  }
});

test("학비의 로컬 학년도가 없으면 페이지에서 확인된 단일 학년도만 상속한다", async () => {
  const singleCycle = await readMoneyFixture("SingleCycle", [
    "This course information applies to the 2026/27 academic year.",
    "International tuition fee £31,200 full-time."
  ]);
  const singleTuition = singleCycle.analysis.fields.find(
    (field) => field.key === "tuitionFee"
  );
  assert.equal(singleCycle.payload.pageAcademicCycles.length, 1);
  assert.equal(singleCycle.payload.tuitionFeeCandidates[0].academicCycle, "2026/27");
  assert.equal(singleTuition.status, "found");
  assert.equal(singleTuition.value, "£31,200");

  const mixedCycles = await readMoneyFixture("MixedCycles", [
    "This page lists fees for 2026/27 and 2027/28 entry.",
    "International tuition fee £31,200 full-time."
  ]);
  const mixedTuition = mixedCycles.analysis.fields.find(
    (field) => field.key === "tuitionFee"
  );
  assert.deepEqual(mixedCycles.payload.pageAcademicCycles, ["2026/27", "2027/28"]);
  assert.equal(mixedCycles.payload.tuitionFeeCandidates[0].academicCycle, "");
  assert.equal(mixedTuition.status, "action_required");
  assert.equal(mixedTuition.reasonCode, "academic_cycle_missing");
});

test("Manchester 통합 과정 페이지는 학비·staged 일정·조건부 서류·한국 GPA를 구분한다", async () => {
  const courseHeading = new FakeNode({
    tag: "h1",
    text: "MSc Mechanical Engineering Design"
  });
  const entryHeading = new FakeNode({ tag: "h2", text: "Entry requirements" });
  const entryText = new FakeNode({
    tag: "p",
    text:
      "The standard academic entry requirement is an Upper Second Class UK Honours degree or international equivalent."
  });
  entryHeading.nextElementSibling = entryText;
  const feesHeading = new FakeNode({ tag: "h2", text: "Fees" });
  entryText.nextElementSibling = feesHeading;
  const tuition = new FakeNode({
    tag: "p",
    text: "Tuition fees for international students in the academic year 2026/27 are £38,400 per annum."
  });
  const deposit = new FakeNode({
    tag: "p",
    text: "International applicants must pay a deposit of £2500 before a CAS is issued."
  });
  const staged = new FakeNode({
    tag: "p",
    text: "Applications to this course are considered through a staged admissions process with selection deadlines."
  });
  const rollForward = new FakeNode({
    tag: "p",
    text: "Applications received after 1 May 2026 may roll your application forward depending on availability."
  });
  const cv = new FakeNode({
    tag: "li",
    text: "A CV if you graduated more than three years ago."
  });
  const documentText = new FakeNode({
    tag: "div",
    text: "References and personal statements are not required for your application for this programme."
  });
  feesHeading.nextElementSibling = tuition;
  tuition.nextElementSibling = deposit;
  deposit.nextElementSibling = staged;
  staged.nextElementSibling = rollForward;
  rollForward.nextElementSibling = cv;
  const root = new FakeNode({
    children: [
      courseHeading,
      entryHeading,
      entryText,
      feesHeading,
      tuition,
      deposit,
      staged,
      rollForward,
      cv,
      documentText
    ]
  });
  root.querySelector = (selector) => selector === "h1" ? courseHeading : null;
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") {
      return [courseHeading, entryHeading, feesHeading];
    }
    if (selector === "p,li,dd,tr") {
      return [entryText, tuition, deposit, staged, rollForward, cv];
    }
    if (selector === "div.text") return [documentText];
    return [];
  };

  const koreaHeading = new FakeNode({
    tag: "h2",
    text: "PG master’s courses (MSc, MA, MRes)"
  });
  const koreaText = new FakeNode({
    tag: "div",
    text:
      "Students who have completed a Haksa degree require a minimum GPA of 3.5 out of 4.5; or minimum GPA of 3.3 out of 4.3."
  });
  const koreaStop = new FakeNode({ tag: "h2", text: "PhD courses" });
  koreaHeading.nextElementSibling = koreaText;
  koreaText.nextElementSibling = koreaStop;
  const koreaRoot = new FakeNode({ children: [koreaHeading, koreaText, koreaStop] });
  koreaRoot.querySelectorAll = (selector) =>
    selector === "h1,h2,h3,h4,h5,h6"
      ? [koreaHeading, koreaStop]
      : [];

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousParser = globalThis.DOMParser;
  globalThis.document = {
    title: "MSc Mechanical Engineering Design | The University of Manchester",
    body: root,
    querySelector: (selector) => selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://www.manchester.ac.uk/study/masters/courses/list/04342/msc-mechanical-engineering-design/",
    hostname: "www.manchester.ac.uk",
    pathname: "/study/masters/courses/list/04342/msc-mechanical-engineering-design/"
  };
  globalThis.fetch = async () => ({ ok: true, text: async () => "korea" });
  globalThis.DOMParser = class {
    parseFromString() {
      return { body: koreaRoot, querySelector: () => koreaRoot };
    }
  };

  const basis = {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  };
  try {
    const payload = await readGenericPage({
      siteKey: "manchester",
      universityName: "The University of Manchester",
      basis,
      koreanAcademicRequirementsUrl:
        "https://www.manchester.ac.uk/study/international/country-specific-information/south-korea/entry-requirements/#country-profile",
      koreanAcademicDefaultDegreeClass: "upper_second",
      additionalContentSelector: "div.text"
    });

    assert.match(payload.entryRequirements, /Upper Second Class/);
    assert.deepEqual(payload.tuitionFeeCandidates.map((item) => item.value), [
      "£38,400"
    ]);
    assert.equal(payload.applicationDeadlineModes.length, 1);
    assert.equal(payload.applicationDeadlineModes[0].kind, "staged");
    assert.equal(payload.applicationDeadlines.length, 0);
    assert.equal(payload.supportingDocuments.reference.status, "not_required");
    assert.equal(payload.supportingDocuments.sopGuideline.status, "not_required");
    assert.equal(
      payload.supportingDocuments.cv.value,
      "Required if graduated more than three years ago"
    );
    assert.equal(payload.koreanAcademicRequirementCandidates.length, 1);
    assert.equal(
      payload.koreanAcademicRequirementCandidates[0].value,
      "GPA 3.5/4.5 or GPA 3.3/4.3"
    );

    const analysis = parseCourseSnapshot(payload, basis);
    const field = (key) => analysis.fields.find((item) => item.key === key);
    assert.equal(
      field("tuitionFee").value,
      "£38,400",
      JSON.stringify(payload.tuitionFeeCandidates)
    );
    assert.equal(field("universityApplicationDeadline").value, "Staged admission");
    assert.equal(field("reference").status, "not_required");
    assert.equal(field("sopGuideline").status, "not_required");
    assert.equal(field("cv").value, "Required if graduated more than three years ago");
    assert.equal(field("koreanAcademicRequirements").value, "GPA 3.5/4.5 or GPA 3.3/4.3");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test("generic reader는 공통 지원기간의 종료일과 마감일 없음 문구를 보존한다", async () => {
  const common = await readMoneyFixture("UCL", [
    "Applications accepted. All applicants: 20 October 2025 – 28 August 2026. Applications close at 5pm UK time."
  ]);
  const commonDeadline = common.analysis.fields.find(
    (field) => field.key === "universityApplicationDeadline"
  );
  assert.equal(common.payload.applicationDeadlines[0].value, "28 August 2026");
  assert.equal(
    common.payload.applicationDeadlines[0].applicantCategory,
    "all_applicants"
  );
  assert.equal(commonDeadline.status, "found");
  assert.equal(commonDeadline.value, "28 August 2026");

  const noClosingDate = await readMoneyFixture("Newcastle", [
    "There is no application closing date for this course."
  ]);
  const noClosingDateField = noClosingDate.analysis.fields.find(
    (field) => field.key === "universityApplicationDeadline"
  );
  assert.equal(
    noClosingDate.payload.applicationDeadlineModes[0].kind,
    "no_closing_date"
  );
  assert.equal(noClosingDateField.status, "found");
  assert.equal(noClosingDateField.value, "No application closing date");
});

test("staged admissions 표는 첫 단계의 application received by 날짜를 우선한다", async () => {
  const stagedText = new FakeNode({
    tag: "p",
    text: "We operate a staged admissions process with selection deadlines."
  });
  const stagedLink = new FakeNode({
    tag: "a",
    text: "Staged Admissions Deadlines",
    href: "https://example.test/masters/how-to-apply/"
  });
  const courseHeading = new FakeNode({ tag: "h1", text: "Management MSc" });
  const root = new FakeNode({ children: [courseHeading, stagedText, stagedLink] });
  root.querySelector = (selector) => selector === "h1" ? courseHeading : null;
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "p,li,dd,tr") return [stagedText];
    if (selector === "p") return [stagedText];
    if (selector === "a[href]") return [stagedLink];
    return [];
  };

  const headerRow = new FakeNode({
    tag: "tr",
    children: [
      new FakeNode({ tag: "th", text: "Stage" }),
      new FakeNode({ tag: "th", text: "Application received by:" }),
      new FakeNode({ tag: "th", text: "Application update by:" })
    ]
  });
  const stageOne = new FakeNode({
    tag: "tr",
    children: [
      new FakeNode({ tag: "td", text: "1" }),
      new FakeNode({ tag: "td", text: "7 December 2025" }),
      new FakeNode({ tag: "td", text: "20 February 2026" })
    ]
  });
  const stageTwo = new FakeNode({
    tag: "tr",
    children: [
      new FakeNode({ tag: "td", text: "2" }),
      new FakeNode({ tag: "td", text: "1 March 2026" }),
      new FakeNode({ tag: "td", text: "1 May 2026" })
    ]
  });
  const table = new FakeNode({
    tag: "table",
    children: [headerRow, stageOne, stageTwo]
  });
  const linkedRoot = new FakeNode({ children: [table] });

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousParser = globalThis.DOMParser;
  globalThis.document = {
    title: "Management MSc",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://example.test/masters/management/",
    hostname: "example.test",
    pathname: "/masters/management/"
  };
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "staged-table"
  });
  globalThis.DOMParser = class {
    parseFromString() {
      return { body: linkedRoot, querySelector: () => linkedRoot };
    }
  };

  const basis = {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  };
  try {
    const payload = await readGenericPage({ basis });
    const analysis = parseCourseSnapshot(payload, basis);
    const deadline = analysis.fields.find(
      (field) => field.key === "universityApplicationDeadline"
    );
    assert.equal(payload.applicationDeadlines.length, 1);
    assert.equal(payload.applicationDeadlines[0].value, "7 December 2025");
    assert.equal(
      payload.applicationDeadlines[0].applicantCategory,
      "staged_first"
    );
    assert.equal(deadline.status, "found");
    assert.equal(deadline.value, "7 December 2025");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test("Warwick generic reader handles a delayed Korea (South) option and result area", async () => {
  const countrySelect = new FakeNode({
    tag: "select",
    children: [],
    value: "",
    attributes: {
      "aria-label": "Select country for international entry requirements"
    }
  });
  const koreanResult = new FakeNode({ tag: "div", text: "" });
  const courseHeading = new FakeNode({
    tag: "h1",
    text: "Marketing & Strategy (MSc)"
  });
  const entryHeading = new FakeNode({
    tag: "h3",
    text: "General entry requirements"
  });
  const degree = new FakeNode({
    tag: "p",
    text: "2:1 undergraduate degree (or equivalent)."
  });
  entryHeading.nextElementSibling = degree;
  degree.nextElementSibling = countrySelect;
  countrySelect.dispatchEvent = (event) => {
    if (event.type === "change") {
      setTimeout(() => {
        koreanResult.innerText =
          "From South Korea, we typically require a Bachelors Degree. " +
          "2:1 Korean GPA (4.3 scale) 3.0 Korean GPA (4.5 scale) 3.5.";
        koreanResult.textContent = koreanResult.innerText;
      }, 30);
    }
  };

  const root = new FakeNode({
    children: [courseHeading, entryHeading, degree, countrySelect, koreanResult]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") {
      return [courseHeading, entryHeading];
    }
    if (selector === "p,li,dd,tr") return [degree];
    if (selector === "select") return [countrySelect];
    return [];
  };
  root.querySelector = (selector) => {
    if (selector === "h1") return courseHeading;
    if (selector === "#international-content") return koreanResult;
    return null;
  };

  setTimeout(() => {
    countrySelect.children.push(
      new FakeNode({
        tag: "option",
        text: "Korea (South)",
        value: "8ac672c69c1c8565019c1e587da70577"
      })
    );
  }, 30);

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Marketing & Strategy (MSc) - Warwick",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://warwick.ac.uk/study/postgraduate/courses/msc-marketing-strategy/",
    hostname: "warwick.ac.uk",
    pathname: "/study/postgraduate/courses/msc-marketing-strategy/"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "warwick",
      universityName: "University of Warwick",
      autoSelectCountry: true,
      koreanAcademicResultSelector: "#international-content",
      basis: { academicCycle: "2026/27" }
    });

    assert.equal(
      countrySelect.value,
      "8ac672c69c1c8565019c1e587da70577"
    );
    assert.equal(
      payload.koreanAcademicRequirementSelection.optionLabel,
      "Korea (South)"
    );
    assert.match(payload.entryRequirements, /2:1 undergraduate degree/);
    assert.doesNotMatch(payload.entryRequirements, /English language requirements/);
    assert.match(payload.koreanAcademicRequirements, /4\.3 scale\) 3\.0/);
    assert.match(payload.koreanAcademicRequirements, /4\.5 scale\) 3\.5/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("generic reader는 하위 제목이 없는 Entry requirements에서 다음 영역을 멈춘다", async () => {
  const courseHeading = new FakeNode({ tag: "h1", text: "Computational Finance MSc" });
  const entryHeading = new FakeNode({ tag: "h2", text: "Entry requirements" });
  const degree = new FakeNode({
    tag: "p",
    text:
      "A minimum of an upper second-class UK bachelor's degree (or international qualification of an equivalent standard)."
  });
  const discipline = new FakeNode({
    tag: "p",
    text:
      "There is not an exhaustive list of relevant disciplines, but applicants with a strong quantitative background are encouraged to apply."
  });
  const englishButton = new FakeNode({
    tag: "button",
    text: "English language requirements"
  });
  const english = new FakeNode({
    tag: "p",
    text: "IELTS overall score of 7.0 with no component below 6.5."
  });
  const international = new FakeNode({
    tag: "p",
    text: "Equivalent qualifications can be checked by selecting a country."
  });
  entryHeading.nextElementSibling = degree;
  degree.nextElementSibling = discipline;
  discipline.nextElementSibling = englishButton;
  englishButton.nextElementSibling = english;
  english.nextElementSibling = international;
  const root = new FakeNode({
    children: [courseHeading, entryHeading, degree, discipline, englishButton, english, international]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") {
      return [courseHeading, entryHeading];
    }
    if (selector === "p,li,dd,tr") {
      return [degree, discipline, english, international];
    }
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Computational Finance MSc - test",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://example.test/programme",
    hostname: "example.test",
    pathname: "/programme"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "ucl",
      universityName: "University College London",
      basis: { academicCycle: "2026/27" }
    });

    assert.match(payload.entryRequirements, /upper second-class/);
    assert.match(payload.entryRequirements, /quantitative background/);
    assert.match(payload.entryRequirements, /or international qualification/);
    assert.match(payload.entryRequirements, /There is not an exhaustive list/);
    assert.doesNotMatch(payload.entryRequirements, /IELTS/);
    assert.doesNotMatch(payload.entryRequirements, /Equivalent qualifications/);
    assert.equal(
      payload.englishRequirement,
      "IELTS overall score of 7.0 with no component below 6.5."
    );
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("UCL형 generic reader는 Level 2와 South Korea 선택을 처리한다", async () => {
  const southKoreaOption = new FakeNode({
    tag: "option",
    text: "South Korea",
    value: "KR"
  });
  const countrySelect = new FakeNode({
    tag: "select",
    children: [southKoreaOption],
    value: "",
    attributes: { name: "country" }
  });
  const courseHeading = new FakeNode({ tag: "h1", text: "Computational Finance MSc" });
  const entryHeading = new FakeNode({ tag: "h2", text: "Entry requirements" });
  const degree = new FakeNode({
    tag: "p",
    text: "A minimum of an upper second-class UK bachelor's degree."
  });
  const english = new FakeNode({
    tag: "p",
    text: "The English language level for this course is: Level 2"
  });
  const englishButton = new FakeNode({
    tag: "button",
    text: "English language requirements"
  });
  const englishLink = new FakeNode({
    tag: "a",
    text: "English language requirements",
    href: "https://www.ucl.ac.uk/prospective-students/graduate/english-language-requirements"
  });
  const koreanHeading = new FakeNode({
    tag: "h4",
    text: "Equivalent qualifications for South Korea"
  });
  const koreanIntro = new FakeNode({
    tag: "p",
    text: "The award of any of the following from a recognised institution:"
  });
  const koreanDegree = new FakeNode({
    tag: "ul",
    text: "Bachelor's degree with a minimum final CGPA of 3.5/4.5 or 3.3/4.3."
  });
  koreanHeading.nextElementSibling = koreanIntro;
  koreanIntro.nextElementSibling = koreanDegree;
  let koreanResultVisible = false;
  countrySelect.dispatchEvent = (event) => {
    if (event.type === "change") {
      setTimeout(() => {
        koreanResultVisible = true;
      }, 30);
    }
  };
  entryHeading.nextElementSibling = degree;
  degree.nextElementSibling = english;
  english.nextElementSibling = countrySelect;
  const root = new FakeNode({
    children: [courseHeading, entryHeading, degree, englishButton, english, englishLink, countrySelect]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") {
      return koreanResultVisible
        ? [courseHeading, entryHeading, koreanHeading]
        : [courseHeading, entryHeading];
    }
    if (selector === "p,li,dd,tr") return [degree, english];
    if (selector === "button") return [englishButton];
    if (selector === "select") return [countrySelect];
    if (selector === "a[href]") return [englishLink];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Computational Finance MSc - test",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computational-finance-msc",
    hostname: "www.ucl.ac.uk",
    pathname: "/prospective-students/graduate/taught-degrees/computational-finance-msc"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "ucl",
      universityName: "University College London",
      autoSelectCountry: true,
      expandEnglishAccordion: true,
      basis: { academicCycle: "2026/27" }
    });

    assert.equal(countrySelect.value, "KR");
    assert.equal(englishButton.clicked, true);
    assert.equal(payload.englishRequirement, "Level 2");
    assert.equal(payload.englishRequirementSourceUrl, globalThis.location.href);
    assert.equal(
      payload.englishRequirementSourceText,
      "The English language level for this course is: Level 2"
    );
    assert.equal(
      payload.englishRequirementDetailUrl,
      "https://www.ucl.ac.uk/prospective-students/graduate/english-language-requirements"
    );
    assert.equal(
      payload.koreanAcademicRequirementSelection.optionLabel,
      "South Korea"
    );
    assert.match(payload.koreanAcademicRequirements, /3\.5\/4\.5/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("generic reader는 같은 학교의 학비 링크 표를 한 단계 따라간다", async () => {
  const tuitionLink = new FakeNode({
    tag: "a",
    text: "MSc Marketing (1 year) tuition fees",
    href:
      "https://study.ed.ac.uk/programmes/postgraduate-taught-campus-fees?programme_code=PTMSCMARKE1F&year=2026"
  });
  const headerRow = new FakeNode({
    tag: "tr",
    children: [
      new FakeNode({ tag: "th", text: "Academic Session" }),
      new FakeNode({ tag: "th", text: "Scotland" }),
      new FakeNode({ tag: "th", text: "International / EU" })
    ]
  });
  const dataRow = new FakeNode({
    tag: "tr",
    children: [
      new FakeNode({ tag: "td", text: "2026/7" }),
      new FakeNode({ tag: "td", text: "£20,100.00" }),
      new FakeNode({ tag: "td", text: "£33,200.00" })
    ]
  });
  const tuitionTable = new FakeNode({
    tag: "table",
    children: [headerRow, dataRow]
  });
  const linkedRoot = new FakeNode({ children: [tuitionTable] });
  linkedRoot.querySelector = (selector) =>
    selector === "main, [role='main']" ? linkedRoot : null;

  const courseHeading = new FakeNode({ tag: "h1", text: "Marketing MSc" });
  const root = new FakeNode({ children: [courseHeading, tuitionLink] });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "a[href]") return [tuitionLink];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousParser = globalThis.DOMParser;
  globalThis.document = {
    title: "Marketing MSc - test",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://study.ed.ac.uk/programmes/postgraduate-taught/638-marketing",
    hostname: "study.ed.ac.uk",
    pathname: "/programmes/postgraduate-taught/638-marketing"
  };
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "<table>fixture</table>"
  });
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        body: linkedRoot,
        querySelector: linkedRoot.querySelector.bind(linkedRoot)
      };
    }
  };

  try {
    const payload = await readGenericPage({
      siteKey: "edinburgh",
      universityName: "University of Edinburgh",
      basis: {
        academicCycle: "2026/27",
        feeStatus: "international"
      }
    });

    assert.equal(payload.tuitionFeeCandidates[0].value, "£33,200.00");
    assert.equal(payload.tuitionFeeCandidates[0].academicCycle, "2026/27");
    assert.equal(payload.tuitionFeeCandidates[0].sourceUrl, tuitionLink.href);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test("연결된 공식 fee 페이지에도 Tuition Fee v2 구조 extractor를 재사용한다", async () => {
  const tuitionLink = new FakeNode({
    tag: "a",
    text: "Finance MSc fees and funding",
    href: "https://example.test/postgraduate/finance/fees-and-funding"
  });
  const linkedRoot = entryNode("main", "", {
    children: [
      entryNode("h2", "Fees and funding"),
      entryNode("div", "", {
        className: "tuition-fee-card",
        children: [
          entryNode("h3", "2026/27 academic year"),
          entryNode(
            "p",
            "International students · full-time tuition fee £42,000 per year"
          ),
          entryNode("p", "A tuition fee deposit of £2,000 is required.")
        ]
      })
    ]
  });
  const courseHeading = new FakeNode({ tag: "h1", text: "Finance MSc" });
  const root = new FakeNode({ children: [courseHeading, tuitionLink] });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "a[href]") return [tuitionLink];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousParser = globalThis.DOMParser;
  globalThis.document = {
    title: "Finance MSc",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://example.test/postgraduate/finance",
    hostname: "example.test",
    pathname: "/postgraduate/finance"
  };
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "<main>linked fixture</main>"
  });
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        body: linkedRoot,
        querySelector: (selector) =>
          selector === "main, [role='main']" ? linkedRoot : null
      };
    }
  };

  const basis = {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  };
  try {
    const payload = await readGenericPage({
      siteKey: "example",
      universityName: "Example University",
      basis
    });
    const analysis = parseCourseSnapshot(payload, basis);
    const tuition = analysis.fields.find((field) => field.key === "tuitionFee");

    assert.equal(
      tuition.value,
      "£42,000",
      JSON.stringify(payload.tuitionFeeCandidates)
    );
    assert.equal(payload.tuitionFeeCandidates[0].sourceUrl, tuitionLink.href);
    assert.equal(
      payload.tuitionFeeCandidates[0].structureType,
      "card_container"
    );
    assert.ok(
      payload.tuitionExtraction.families.includes("Card/Container")
    );
    assert.equal(payload.tuitionExtraction.pageAdapters.linkedFeePage, true);
    assert.doesNotMatch(tuition.source.excerpt, /£2,000/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test("Warwick 공통 학비표는 과정 코드와 현재 기준이 모두 맞는 행만 읽는다", async () => {
  const tuitionLink = new FakeNode({
    tag: "a",
    text: "Find your taught course fees",
    href:
      "https://warwick.ac.uk/services/academicoffice/finance/fees/postgraduatefees/"
  });
  const headers = [
    "Course",
    "Course Code",
    "Course Intensity",
    "Fee Status",
    "2024-25",
    "2025-26",
    "2026-27"
  ];
  const headerRow = new FakeNode({
    tag: "tr",
    children: headers.map((text) => new FakeNode({ tag: "th", text }))
  });
  const row = (cells) =>
    new FakeNode({
      tag: "tr",
      children: cells.map((text) => new FakeNode({ tag: "td", text }))
    });
  const tuitionTable = new FakeNode({
    tag: "table",
    children: [
      headerRow,
      row([
        "Management (MSc)",
        "P-N2N3",
        "Full Time",
        "Overseas",
        "£36,250",
        "£37,270",
        "£38,570"
      ]),
      row([
        "Marketing and Strategy (MSc)",
        "P-N500",
        "Full Time",
        "Home",
        "£27,300",
        "£28,270",
        "£29,200"
      ]),
      row([
        "Marketing and Strategy (MSc)",
        "P-N500",
        "Full Time",
        "Overseas",
        "£34,550",
        "£36,270",
        "£37,450"
      ])
    ]
  });
  const linkedRoot = new FakeNode({ children: [tuitionTable] });
  linkedRoot.querySelector = (selector) =>
    selector === "main, [role='main']" ? linkedRoot : null;

  const courseHeading = new FakeNode({
    tag: "h1",
    text: "Marketing & Strategy (MSc)"
  });
  const root = new FakeNode({
    text: "Marketing & Strategy (MSc) Course code P-N500",
    children: [courseHeading, tuitionLink]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "a[href]") return [tuitionLink];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousParser = globalThis.DOMParser;
  globalThis.document = {
    title: "Marketing & Strategy (MSc) - Warwick",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://warwick.ac.uk/study/postgraduate/courses/msc-marketing-strategy/",
    hostname: "warwick.ac.uk",
    pathname: "/study/postgraduate/courses/msc-marketing-strategy/"
  };
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "<table>fixture</table>"
  });
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        body: linkedRoot,
        querySelector: linkedRoot.querySelector.bind(linkedRoot)
      };
    }
  };

  try {
    const payload = await readGenericPage({
      siteKey: "warwick",
      universityName: "University of Warwick",
      basis: {
        academicCycle: "2026/27",
        studyMode: "full-time",
        feeStatus: "international"
      }
    });

    assert.deepEqual(
      payload.tuitionFeeCandidates.map((candidate) => candidate.value),
      ["£37,450"]
    );
    assert.equal(payload.tuitionFeeCandidates[0].academicCycle, "2026/27");
    assert.equal(payload.tuitionFeeCandidates[0].studyMode, "full-time");
    assert.match(payload.tuitionFeeCandidates[0].rawText, /P-N500/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test("과정 페이지에서 학비를 찾으면 공통 학비 링크의 보증금을 후보로 추가하지 않는다", async () => {
  const courseHeading = new FakeNode({
    tag: "h1",
    text: "Strategic Management of Projects MSc"
  });
  const tuition = new FakeNode({
    tag: "p",
    text: "International students Tuition fees (2026/27) £50,600"
  });
  const tuitionLink = new FakeNode({
    tag: "a",
    text: "Tuition fees",
    href: "https://www.ucl.ac.uk/prospective-students/graduate/tuition-fees"
  });
  const root = new FakeNode({ children: [courseHeading, tuition, tuitionLink] });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "p,li,dd,tr") return [tuition];
    if (selector === "a[href]") return [tuitionLink];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.document = {
    title: "Strategic Management of Projects MSc | UCL",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/strategic-management-projects-msc",
    hostname: "www.ucl.ac.uk",
    pathname: "/prospective-students/graduate/taught-degrees/strategic-management-projects-msc"
  };
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("direct tuition should prevent linked fee fallback");
  };

  try {
    const payload = await readGenericPage({
      siteKey: "ucl",
      universityName: "University College London",
      basis: {
        academicCycle: "2026/27",
        intakeMonth: 9,
        intakeYear: 2026,
        studyMode: "full-time",
        feeStatus: "international"
      }
    });

    assert.equal(fetchCount, 0);
    assert.deepEqual(
      payload.tuitionFeeCandidates.map((candidate) => candidate.value),
      ["£50,600"]
    );
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
  }
});

test("generic reader는 국가 선택과 지원 안내 링크를 후속 확인 대상으로 보존한다", async () => {
  const southKoreaOption = new FakeNode({
    tag: "option",
    text: "Korea, Republic of",
    value: "KOR"
  });
  const countrySelect = new FakeNode({
    tag: "select",
    children: [southKoreaOption],
    attributes: { name: "country" }
  });
  const howToApplyLink = new FakeNode({
    tag: "a",
    text: "How to apply",
    href: "https://example.test/how-to-apply"
  });
  const courseHeading = new FakeNode({ tag: "h1", text: "Marketing MSc" });
  const root = new FakeNode({
    children: [courseHeading, countrySelect, howToApplyLink]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "select") return [countrySelect];
    if (selector === "a[href]") return [howToApplyLink];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Marketing MSc - test",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://example.test/programme",
    hostname: "example.test",
    pathname: "/programme"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "example",
      universityName: "Example University",
      basis: { academicCycle: "2026/27" }
    });

    assert.equal(
      payload.koreanAcademicRequirementSelection.optionLabel,
      "Korea, Republic of"
    );
    assert.equal(
      payload.koreanAcademicRequirementSelection.optionValue,
      "KOR"
    );
    assert.equal(payload.supportingDocumentLinks.reference.url, howToApplyLink.href);
    assert.equal(payload.supportingDocumentLinks.sopGuideline.url, howToApplyLink.href);
    assert.equal(payload.supportingDocumentLinks.cv.url, howToApplyLink.href);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("generic reader는 지원 서류를 요구하지 않는다는 문구를 별도 상태로 보존한다", async () => {
  const courseHeading = new FakeNode({ tag: "h1", text: "Marketing MSc" });
  const reference = new FakeNode({
    tag: "p",
    text: "We will not ask you to provide references for this programme."
  });
  const statement = new FakeNode({
    tag: "p",
    text: "We do not require a personal statement for this course."
  });
  const cv = new FakeNode({
    tag: "p",
    text: "A CV is not required as part of your application."
  });
  const rolling = new FakeNode({
    tag: "p",
    text: "Applications are considered on a rolling basis."
  });
  const root = new FakeNode({
    children: [courseHeading, reference, statement, cv, rolling]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "p,li,dd,tr") return [reference, statement, cv, rolling];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Marketing MSc - test",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://example.test/programme",
    hostname: "example.test",
    pathname: "/programme"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "sheffield",
      universityName: "University of Sheffield",
      basis: { academicCycle: "2026/27" }
    });

    assert.equal(payload.supportingDocuments.reference.status, "not_required");
    assert.equal(payload.supportingDocuments.sopGuideline.status, "not_required");
    assert.equal(payload.supportingDocuments.cv.status, "not_required");
    assert.equal(payload.applicationDeadlineModes[0].kind, "rolling");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("UCL Next steps에서 지원비·비자별 마감일·추천서·SOP를 구조화한다", async () => {
  const courseHeading = new FakeNode({
    tag: "h1",
    text: "Computational Finance MSc"
  });
  const applicationFee = new FakeNode({
    tag: "p",
    text: "There is an application processing fee of £90 for online applications."
  });
  const statementIntro = new FakeNode({
    tag: "p",
    text: "When we assess your application we would like to learn:"
  });
  const statementBullets = [
    "why you want to study Computational Finance at graduate level",
    "why you want to study Computational Finance at UCL",
    "what particularly attracts you to this programme",
    "how your academic and professional background meets the demands of this programme",
    "where you would like to go professionally with your degree"
  ].map((text) => new FakeNode({ tag: "li", text }));
  const statementList = new FakeNode({ tag: "ul", children: statementBullets });
  statementIntro.nextElementSibling = statementList;
  const statementContext = new FakeNode({
    tag: "p",
    text: "Your personal statement is your opportunity to explain your reasons for applying to the programme."
  });
  const referenceAlert = new FakeNode({
    tag: "div",
    text: "This course requires two references."
  });
  const visaRequired = new FakeNode({
    tag: "div",
    text: "Applicants who require a visa: 20 Oct 2025 – 27 Mar 2026 Applications closed"
  });
  const visaNotRequired = new FakeNode({
    tag: "div",
    text: "Applicants who do not require a visa: 20 Oct 2025 – 28 Aug 2026"
  });
  const applicationGuidance = new FakeNode({
    tag: "a",
    text: "Application Guidance",
    href: "https://www.ucl.ac.uk/prospective-students/graduate/apply"
  });
  const root = new FakeNode({
    children: [
      courseHeading,
      applicationFee,
      statementIntro,
      statementList,
      statementContext,
      referenceAlert,
      visaRequired,
      visaNotRequired,
      applicationGuidance
    ]
  });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return [courseHeading];
    if (selector === "p,li,dd,tr") {
      return [applicationFee, statementIntro, ...statementBullets, statementContext];
    }
    if (selector === "[role='alert']") return [referenceAlert];
    if (selector === "p") return [applicationFee, statementIntro, statementContext];
    if (selector === "div") return [referenceAlert, visaRequired, visaNotRequired];
    if (selector === "a[href]") return [applicationGuidance];
    return [];
  };
  root.querySelector = (selector) =>
    selector === "h1" ? courseHeading : null;

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    title: "Computational Finance MSc | UCL",
    body: root,
    querySelector: (selector) =>
      selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computational-finance-msc",
    hostname: "www.ucl.ac.uk",
    pathname: "/prospective-students/graduate/taught-degrees/computational-finance-msc"
  };

  try {
    const payload = await readGenericPage({
      siteKey: "ucl",
      universityName: "University College London",
      captureVisaRequiredDeadline: true,
      basis: {
        academicCycle: "2026/27",
        intakeMonth: 9,
        intakeYear: 2026,
        feeStatus: "international"
      }
    });

    assert.equal(payload.applicationFeeCandidates[0].value, "£90");
    assert.deepEqual(
      payload.applicationDeadlines.map((candidate) => ({
        category: candidate.applicantCategory,
        value: candidate.value
      })),
      [
        { category: "visa_required", value: "27 Mar 2026" }
      ]
    );
    assert.equal(payload.supportingDocuments.reference.status, "found");
    assert.match(payload.supportingDocuments.reference.value, /two references/i);
    assert.equal(payload.supportingDocuments.sopGuideline.value, "Required");
    assert.match(payload.supportingDocuments.sopGuideline.detail, /why you want to study/i);
    assert.equal(
      payload.supportingDocumentLinks.cv.url,
      applicationGuidance.href
    );
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test("Sheffield reader follows registered official pages without mixing sections", async () => {
  const courseHeading = new FakeNode({ tag: "h1", text: "Real Estate MSc" });
  const entryHeading = new FakeNode({ tag: "h2", text: "Entry requirements" });
  const degree = new FakeNode({
    tag: "p",
    text: "Minimum 2:1 undergraduate honours degree in any subject."
  });
  const assessment = new FakeNode({
    tag: "p",
    text: "We assess each application on the basis of preparation and achievement as a whole."
  });
  const international = new FakeNode({
    tag: "p",
    text: "We also consider a wide range of international qualifications."
  });
  const englishHeading = new FakeNode({ tag: "h3", text: "English language requirements" });
  const ielts = new FakeNode({
    tag: "p",
    text: "IELTS 6.5 (with 6 in each component) or University equivalent"
  });
  const otherHeading = new FakeNode({ tag: "h3", text: "Other requirements" });
  const reference = new FakeNode({
    tag: "p",
    text: "We will not ask you to provide references or referee details as part of your application."
  });
  const statement = new FakeNode({
    tag: "p",
    text: "We do not require a supporting statement for this programme."
  });
  const feesHeading = new FakeNode({ tag: "h2", text: "Fees and funding" });
  const overseasFee = new FakeNode({
    tag: "p",
    text: "Overseas students 2026-27 tuition fee £26,320"
  });
  const applyHeading = new FakeNode({ tag: "h2", text: "Apply" });
  entryHeading.nextElementSibling = degree;
  degree.nextElementSibling = assessment;
  assessment.nextElementSibling = international;
  international.nextElementSibling = englishHeading;
  englishHeading.nextElementSibling = ielts;
  ielts.nextElementSibling = otherHeading;
  otherHeading.nextElementSibling = reference;
  reference.nextElementSibling = statement;
  statement.nextElementSibling = feesHeading;
  feesHeading.nextElementSibling = overseasFee;
  overseasFee.nextElementSibling = applyHeading;

  const headings = [courseHeading, entryHeading, englishHeading, otherHeading, feesHeading, applyHeading];
  const paragraphs = [degree, assessment, international, ielts, reference, statement, overseasFee];
  const root = new FakeNode({ children: [...headings, ...paragraphs] });
  root.querySelectorAll = (selector) => {
    if (selector === "h1,h2,h3,h4,h5,h6") return headings;
    if (selector === "p,li,dd,tr") return paragraphs;
    return [];
  };
  root.querySelector = (selector) => selector === "h1" ? courseHeading : null;

  const koreaHeading = new FakeNode({ tag: "h2", text: "Postgraduate Taught Programmes e.g. MA, MSc" });
  const koreaIntro = new FakeNode({ tag: "p", text: "Most postgraduate courses require a UK 2:1 or equivalent for entry." });
  const koreaTable = new FakeNode({
    tag: "table",
    text: "Bachelor degree 2:1 (Upper Second Class Honours) GPA 3.5/4.5, GPA 3.1/4.3, GPA 3.0/4.0"
  });
  const koreaRow = new FakeNode({
    tag: "tr",
    children: [
      new FakeNode({ tag: "td", text: "Bachelor degree" }),
      new FakeNode({ tag: "td", text: "2:1 (Upper Second Class Honours)" }),
      new FakeNode({ tag: "td", text: "GPA 3.5/4.5, GPA 3.1/4.3, GPA 3.0/4.0" })
    ]
  });
  const researchHeading = new FakeNode({ tag: "h2", text: "For Entry to Postgraduate Research Programmes" });
  koreaHeading.nextElementSibling = koreaIntro;
  koreaIntro.nextElementSibling = koreaTable;
  koreaTable.nextElementSibling = researchHeading;
  const koreaRoot = new FakeNode({ children: [koreaHeading, koreaIntro, koreaTable, koreaRow] });
  koreaRoot.querySelectorAll = (selector) => selector === "h1,h2,h3,h4,h5,h6" ? [koreaHeading, researchHeading] : [];

  const noFee = new FakeNode({
    tag: "p",
    text: "There is no application fee to apply for Postgraduate Taught Masters degree programmes."
  });
  const applicationRoot = new FakeNode({ children: [noFee] });
  const deadlineRow = new FakeNode({
    tag: "tr",
    text: "Tuesday 1 September 2026 Last date to apply for a postgraduate course if you'll need a visa to study in the UK"
  });
  const deadlineRoot = new FakeNode({ children: [deadlineRow] });
  const cvDetail = new FakeNode({
    tag: "dd",
    text: "You may also wish to supply a curriculum vitae (CV) or resume."
  });
  const cvTerm = new FakeNode({ tag: "dt", next: cvDetail });
  const cvLink = new FakeNode({
    tag: "a",
    text: "Curriculum vitae (CV)/resume",
    href: "https://sheffield.ac.uk/postgraduate/supporting#CurriculumvitaeCVresume",
    closestMap: { dt: cvTerm }
  });
  const cvRoot = new FakeNode({ children: [cvLink, cvTerm, cvDetail] });
  cvRoot.querySelectorAll = (selector) => selector === "a[href]" ? [cvLink] : [];

  const linkedRoots = new Map([
    ["korea", koreaRoot],
    ["application", applicationRoot],
    ["deadline", deadlineRoot],
    ["supporting", cvRoot]
  ]);
  for (const linkedRoot of linkedRoots.values()) {
    const originalQuerySelectorAll = linkedRoot.querySelectorAll.bind(linkedRoot);
    linkedRoot.querySelectorAll = (selector) => {
      if (selector === "p,li,dd,tr") {
        return linkedRoot.children.filter((node) => /^(?:P|LI|DD|TR)$/.test(node.tagName));
      }
      if (selector === "tr") {
        return linkedRoot.children.filter((node) => node.tagName === "TR");
      }
      return originalQuerySelectorAll(selector);
    };
  }

  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousParser = globalThis.DOMParser;
  globalThis.document = {
    title: "Real Estate MSc | 2026 | Postgraduate",
    body: root,
    querySelector: (selector) => selector === "main, [role='main']" ? root : null,
    querySelectorAll: () => []
  };
  globalThis.location = {
    href: "https://sheffield.ac.uk/postgraduate/taught/courses/2026/real-estate-msc#entry-req",
    hostname: "sheffield.ac.uk",
    pathname: "/postgraduate/taught/courses/2026/real-estate-msc"
  };
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => url.includes("south-korea")
      ? "korea"
      : url.includes("postgraduate-taught")
        ? "application"
        : url.includes("deadlines")
          ? "deadline"
          : "supporting"
  });
  globalThis.DOMParser = class {
    parseFromString(marker) {
      const linkedRoot = linkedRoots.get(marker);
      return { body: linkedRoot, querySelector: () => linkedRoot };
    }
  };

  const basis = {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  };
  try {
    const payload = await readGenericPage({
      siteKey: "sheffield",
      universityName: "University of Sheffield",
      basis,
      koreanAcademicRequirementsUrl: "https://sheffield.ac.uk/international/entry-requirements/south-korea",
      applicationFeeUrl: "https://sheffield.ac.uk/international/applying/postgraduate-taught",
      applicationDeadlineUrl: "https://sheffield.ac.uk/postgraduate/deadlines#September2026entry",
      cvGuidelineUrl: "https://sheffield.ac.uk/postgraduate/supporting#CurriculumvitaeCVresume"
    });

    assert.match(payload.entryRequirements, /Minimum 2:1/);
    assert.doesNotMatch(payload.entryRequirements, /English language/);
    assert.doesNotMatch(payload.entryRequirements, /wide range of/);
    assert.match(payload.koreanAcademicRequirements, /GPA 3\.5\/4\.5/);
    assert.equal(payload.tuitionFeeCandidates[0].value, "£26,320");
    assert.equal(payload.tuitionFeeCandidates[0].academicCycle, "2026/27");
    assert.equal(payload.applicationFeeCandidates[0].value, "No application fee");
    assert.equal(payload.applicationDeadlines[0].value, "1 September 2026");
    assert.equal(payload.applicationDeadlines[0].applicantCategory, "visa_required");
    assert.equal(payload.supportingDocuments.reference.status, "not_required");
    assert.equal(payload.supportingDocuments.sopGuideline.status, "not_required");
    assert.equal(payload.supportingDocuments.cv.value, "Optional");

    const analysis = parseCourseSnapshot(payload, basis);
    const field = (key) => analysis.fields.find((item) => item.key === key);
    assert.equal(field("koreanAcademicRequirements").value, "GPA 3.5/4.5, GPA 3.1/4.3, GPA 3.0/4.0");
    assert.equal(field("tuitionFee").value, "£26,320");
    assert.equal(field("applicationFee").status, "not_required");
    assert.equal(field("universityApplicationDeadline").value, "1 September 2026");
    assert.equal(field("reference").status, "not_required");
    assert.equal(field("sopGuideline").status, "not_required");
    assert.equal(field("cv").value, "Optional");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});
