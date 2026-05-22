const probes: { path: string; label: string }[] = [
  { path: "../ai-provenance/probe.ts", label: "ai-provenance probe" },
  { path: "../ai-provenance/classify.ts", label: "ai-provenance classify" },
  { path: "../byoi/probe.ts", label: "byoi probe" },
  { path: "../enterprise-knowledge/probe.ts", label: "enterprise-knowledge probe" },
  { path: "../enterprise-knowledge/classify.ts", label: "enterprise-knowledge classify" },
  { path: "../fandom-canon/probe.ts", label: "fandom-canon probe" },
  { path: "../fandom-canon/classify.ts", label: "fandom-canon classify" },
  { path: "../legal-chronology/probe.ts", label: "legal-chronology probe" },
  { path: "../legal-chronology/classify.ts", label: "legal-chronology classify" },
  { path: "../public-reference-monitoring/probe.ts", label: "public-reference-monitoring probe" },
  { path: "../public-reference-monitoring/classify.ts", label: "public-reference-monitoring classify" },
  { path: "../standards-intelligence/probe.ts", label: "standards-intelligence probe" },
  { path: "../standards-intelligence/classify.ts", label: "standards-intelligence classify" },
  { path: "../lib/inference.ts", label: "inference lib" },
  { path: "../lib/loadEvents.ts", label: "loadEvents lib" },
  { path: "../lib/runProbe.ts", label: "runProbe lib" },
  { path: "../lib/signals.ts", label: "signals lib" },
];

let passed = 0;
let failed = 0;

for (const { path, label } of probes) {
  try {
    const mod = await import(path);
    const exports = Object.keys(mod);
    console.log(`  PASS  ${label} (exports: ${exports.slice(0, 3).join(", ")})`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${label}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

export {};
