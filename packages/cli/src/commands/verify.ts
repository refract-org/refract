import { readFileSync, writeFileSync } from "node:fs";
import type { VerificationBundle } from "@refract-org/evidence-graph";
import { verifyVerificationBundle } from "@refract-org/evidence-graph";
import { renderVerificationHtmlReceipt } from "../html-renderer.js";
import { bold, cyan, dim, green, red, success } from "../render.js";

export async function runVerify(bundlePath: string, htmlOutPath?: string): Promise<void> {
  let rawJson: string;
  try {
    rawJson = readFileSync(bundlePath, "utf-8");
  } catch (err) {
    console.error(red(`Failed to read verification bundle file at "${bundlePath}": ${err}`));
    process.exit(1);
  }

  let bundle: VerificationBundle;
  try {
    bundle = JSON.parse(rawJson) as VerificationBundle;
  } catch (err) {
    console.error(red(`Failed to parse verification bundle JSON: ${err}`));
    process.exit(1);
  }

  const result = verifyVerificationBundle(bundle);

  console.log(bold("\nRefract verification bundle"));
  console.log(dim("──────────────────────────────────────────────────"));
  console.log(`Page:          ${cyan(bundle.manifest?.pageTitle || "unknown")}`);
  console.log(`Generated:     ${bundle.manifest?.generatedAt || "unknown"}`);
  console.log(`Manifest hash: ${bundle.manifest?.manifestHash || "none"}`);
  console.log(`Merkle root:   ${bundle.manifest?.merkleRoot || "none"}`);
  console.log(`Events:        ${bundle.events?.length ?? 0}`);
  console.log(`Proofs:        ${bundle.proofs?.length ?? 0}`);
  console.log(dim("──────────────────────────────────────────────────"));

  if (result.valid) {
    console.log(success("Checks passed: manifest hash, Merkle root, event count, each proof against its own root."));
    console.log(
      dim(
        "Not checked: event contents against their listed hashes, or proof roots against the manifest root. Nothing in the bundle is signed.",
      ),
    );
  } else {
    console.error(red("Checks failed:"));
    for (const err of result.errors) {
      console.error(red(`  - ${err}`));
    }
  }

  if (htmlOutPath) {
    const html = renderVerificationHtmlReceipt(bundle, result);
    try {
      writeFileSync(htmlOutPath, html, "utf-8");
      console.log(green(`\nSaved verification HTML receipt to: ${htmlOutPath}`));
    } catch (err) {
      console.error(red(`Failed to write HTML receipt to "${htmlOutPath}": ${err}`));
    }
  }

  if (!result.valid) {
    process.exit(1);
  }
}
