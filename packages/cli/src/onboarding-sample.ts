import type { Revision } from "@refract-org/evidence-graph";

export const onboardingPageTitle = "Rivergate Library (fictional)";

const earlyHours = "Rivergate Library is open until six every weekday throughout the year.";
const lateHours = "Rivergate Library is open until eight every weekday throughout the year.";
const citation = "<ref>{{cite web|url=https://example.org/rivergate/hours|title=Rivergate opening hours}}</ref>";
const printing = "The library provides free printing for all registered members.";
const closing = "The reading room has space for thirty seated visitors.";

// These IDs and dates belong only to the fictional fixture, not to a live wiki.
export const onboardingRevisions: Revision[] = [
  `${earlyHours}${citation}\n\n${printing}\n\n${closing}`,
  `${lateHours}${citation}\n\n${printing}\n\n${closing}`,
  `${lateHours}\n\n${printing}\n\n${closing}`,
  `${lateHours}\n\n${closing}`,
  `${lateHours}\n\n${printing}\n\n${closing}`,
].map((content, i) => ({
  revId: i + 1,
  pageId: 1,
  pageTitle: onboardingPageTitle,
  timestamp: `2025-01-0${i + 1}T12:00:00Z`,
  comment: "Fictional onboarding revision",
  content,
  size: Buffer.byteLength(content, "utf8"),
  minor: false,
}));
