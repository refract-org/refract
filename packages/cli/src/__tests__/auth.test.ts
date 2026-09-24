import { afterEach, describe, expect, it, vi } from "vitest";
import { extractAuth } from "../index.js";

describe("extractAuth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not pick up generically named client credentials from the environment", () => {
    // Set for some other tool on a CI runner. These used to be read as Refract's
    // and sent as headers to whatever wiki was queried, Wikipedia by default.
    vi.stubEnv("OAUTH_CLIENT_ID", "someone-elses-id");
    vi.stubEnv("OAUTH_CLIENT_SECRET", "someone-elses-secret");

    expect(extractAuth({})).toBeUndefined();
  });

  it("reads client credentials from the REFRACT_-prefixed variables", () => {
    vi.stubEnv("REFRACT_OAUTH_CLIENT_ID", "id");
    vi.stubEnv("REFRACT_OAUTH_CLIENT_SECRET", "secret");

    expect(extractAuth({})).toMatchObject({ oauthClientId: "id", oauthClientSecret: "secret" });
  });

  it("passes explicit flags through", () => {
    expect(extractAuth({ apiKey: "token" })).toMatchObject({ apiKey: "token" });
  });
});
