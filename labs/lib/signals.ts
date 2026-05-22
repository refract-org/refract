import type { EvidenceEvent } from "@refract-org/evidence-graph";

export function eventsInWindow(events: EvidenceEvent[], days: number): EvidenceEvent[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff.getTime());
}

export function countEventType(events: EvidenceEvent[], type: string): number {
  return events.filter((e) => e.eventType === type).length;
}

export function eventsOfType(events: EvidenceEvent[], ...types: string[]): EvidenceEvent[] {
  return events.filter((e) => types.includes(e.eventType));
}

export function sectionChurn(events: EvidenceEvent[]): Map<string, number> {
  const churn = new Map<string, number>();
  for (const e of events) {
    const section = e.section || "(lead)";
    churn.set(section, (churn.get(section) ?? 0) + 1);
  }
  return churn;
}

export function recentChangesSummary(events: EvidenceEvent[], days = 14) {
  const recent = eventsInWindow(events, days);
  const bySection = sectionChurn(recent);
  return {
    totalEvents: recent.length,
    sections: Object.fromEntries(bySection),
    newestEvent: recent.length > 0 ? recent[recent.length - 1].timestamp : null,
  };
}


