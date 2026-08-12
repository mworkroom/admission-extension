export function focusSourceInPage(source = {}) {
  const normalize = (value) =>
    String(value ?? "").replace(/\s+/g, " ").trim();
  const excerpt = normalize(source.excerpt);
  const sectionLabel = normalize(source.sectionLabel);
  const root =
    document.querySelector("main, [role='main']") ||
    document.body;

  if (!root || (!excerpt && !sectionLabel)) {
    return { found: false, reason: "source_text_missing" };
  }

  const candidates = Array.from(
    root.querySelectorAll(
      "p, li, dd, dt, tr, [role='alert'], h1, h2, h3, h4, h5, h6, section, article, div"
    )
  )
    .map((element) => ({
      element,
      text: normalize(element.innerText || element.textContent)
    }))
    .filter(({ text }) => text.length >= 5 && text.length <= 6000);

  const excerptWords = new Set(
    excerpt
      .toLowerCase()
      .split(/[^\p{L}\p{N}£]+/u)
      .filter((word) => word.length >= 3)
  );

  const scoreCandidate = ({ element, text }) => {
    const lowerText = text.toLowerCase();
    const lowerExcerpt = excerpt.toLowerCase();
    const lowerSection = sectionLabel.toLowerCase();
    let score = 0;

    if (lowerExcerpt) {
      if (lowerText === lowerExcerpt) {
        score += 20000;
      } else if (lowerText.includes(lowerExcerpt)) {
        score += 15000 - Math.min(4000, lowerText.length - lowerExcerpt.length);
      } else if (lowerExcerpt.includes(lowerText) && lowerText.length >= 18) {
        score += 9000 + Math.min(3000, lowerText.length);
      } else {
        const words = new Set(
          lowerText
            .split(/[^\p{L}\p{N}£]+/u)
            .filter((word) => word.length >= 3)
        );
        let overlap = 0;
        for (const word of excerptWords) {
          if (words.has(word)) overlap += 1;
        }
        if (overlap >= 3) {
          score += overlap * 240;
        }
      }
    }

    if (/^H[1-6]$/.test(element.tagName) && lowerSection) {
      if (lowerText === lowerSection) score += 7000;
      else if (lowerText.includes(lowerSection) || lowerSection.includes(lowerText)) {
        score += 3500;
      }
    }

    score -= Math.min(1200, text.length / 5);
    score -= Math.min(600, element.children?.length * 12 || 0);
    return score;
  };

  const ranked = candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  const target = ranked[0]?.element || null;

  if (!target) {
    return { found: false, reason: "source_element_not_found" };
  }

  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === "DETAILS") parent.open = true;
  }

  const styleId = "admission-source-focus-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [data-admission-source-focus="true"] {
        scroll-margin-block: 22vh;
        outline: 3px solid #f2b84b !important;
        outline-offset: 5px !important;
        background-color: #fff4c2 !important;
        transition: outline-color 180ms ease, background-color 180ms ease !important;
      }
    `;
    (document.head || document.documentElement).append(style);
  }

  for (const previous of document.querySelectorAll(
    '[data-admission-source-focus="true"]'
  )) {
    previous.removeAttribute("data-admission-source-focus");
  }

  const previousTabIndex = target.getAttribute("tabindex");
  target.setAttribute("data-admission-source-focus", "true");
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  target.focus({ preventScroll: true });

  window.setTimeout(() => {
    target.removeAttribute("data-admission-source-focus");
    if (previousTabIndex === null) target.removeAttribute("tabindex");
    else target.setAttribute("tabindex", previousTabIndex);
  }, 2600);

  return {
    found: true,
    matchedText: normalize(target.innerText || target.textContent).slice(0, 220)
  };
}
