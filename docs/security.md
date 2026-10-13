# Security considerations

## Credential exposure

CLI flags containing credentials (`--api-key`, `--api-password`) are visible in process listings.

Expanding an environment variable into `--api-key "$WIKI_API_KEY"` still puts
the expanded value in the process arguments. It does not prevent this exposure.
The bearer-token and basic-auth CLI options currently receive values through
arguments. For a gateway that supports the client-header method, Refract reads
`REFRACT_OAUTH_CLIENT_ID` and `REFRACT_OAUTH_CLIENT_SECRET` directly from the
environment. That method requires a compatible gateway; it is not a substitute
for bearer authentication on an arbitrary wiki.

## Local storage

When using `--cache`, revision content is persisted to `~/.wikihistory/refract.db` (SQLite). This file contains full wikitext from every revision fetched. If you analyze private wikis, this database becomes a local copy of private content.

**Recommendation:** Don't use `--cache` with private wikis on shared machines, or configure `--cache-dir` to an encrypted volume.

## Network

Refract makes outbound HTTPS requests to:
- The configured MediaWiki API (`--api`)
- Slack/email/webhook endpoints when notifications are configured (`--notify-*`)

API transport follows the configured URL. Use an HTTPS endpoint for private
wiki credentials. Bearer and basic-auth credentials use `Authorization`;
gateway client credentials use the `X-OAuth-Client-Id` and
`X-OAuth-Client-Secret` headers. See [instance access](./usage.md#other-mediawiki-instances).

## Reporting vulnerabilities

See [.github/SECURITY.md](../.github/SECURITY.md) for the vulnerability reporting process.
