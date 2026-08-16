#!/usr/bin/env node
import { cli } from "./index.js";

cli(process.argv.slice(2)).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("API key") || msg.includes("api_key") || msg.includes("Authorization")) {
    console.error("refract: authentication error — check your API credentials");
  } else {
    console.error("refract:", msg);
  }
  process.exit(1);
});
