# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` branch | yes (latest, security fixes backported) |
| Tagged releases (`v1.x.y`) | yes, for the most recent 2 minor versions |
| Older tags | no |

The current production-ready branch is `phase-1-production-stabilization`.

## Reporting a vulnerability

**Please do not file a public issue for security problems.** Public disclosure before a fix is shipped gives attackers a free shot at every deployment.

Instead, open a **private security advisory** at:

> https://github.com/AadityaLabsAI/MerchantOS/security/advisories/new

If for any reason you cannot use GitHub's advisory mechanism, contact the maintainers via the issue tracker marked `@maintainers` and request a private channel. Do not paste exploit details into a public issue even if you later mark it as a draft.

## What to include in a report

A good security report saves everyone time. Please include:

1. The product version (commit SHA, tag, or `git describe` output).
2. The deployment shape (single-store, multi-store, with/without AI enabled, behind which reverse proxy, OS).
3. A clear description of the vulnerability and the impact you believe it has.
4. A reproducible proof of concept — minimal curl commands, a small script, or a network capture. Screenshots are not enough.
5. Any known workarounds.
6. Whether you intend to disclose publicly, and on what timeline.

## What to expect

| Time after report | Action |
|---|---|
| within 3 business days | acknowledgement and a triage owner |
| within 10 business days | an initial severity assessment and a tentative fix plan |
| within 30 days of confirmation | a patched release, or an honest explanation of why it will take longer |

Severity is assessed using CVSS 3.1. Critical and High findings are prioritized over feature work.

## Coordinated disclosure

We follow a 90-day coordinated disclosure timeline. If you need more time before public disclosure, tell us in the report and we will work with you. If we cannot reach a fix within 90 days, we will discuss a joint disclosure date with you rather than silently extending the embargo.

## Hall of fame

Reporters of confirmed vulnerabilities are credited in `CHANGELOG.md` (with their permission) and listed in this file under "Acknowledgements". We do not run a paid bug bounty at this time.

## Safe-harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, destruction of data, or interruption of our services.
- Only interact with accounts they own or with explicit permission from the account holder.
- Stop testing as soon as a vulnerability is confirmed and contact us before doing anything further.
- Do not exploit a vulnerability beyond what is necessary to demonstrate it.

This is a best-effort commitment from a small open-source project, not a legal contract. If you need a formal safe-harbor for your organization, contact us before testing.

## Security-relevant configuration

The operator is responsible for:

- Setting strong `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `WEBHOOK_HMAC_SECRET` (≥ 32 chars; `openssl rand -base64 48`).
- Rotating those secrets on any suspicion of compromise.
- Configuring `TRUSTED_PROXIES` to the actual reverse-proxy IPs/CIDRs (empty = trust none, forwarded headers are ignored).
- Running the api behind TLS (Caddy / Traefik / Nginx). The api speaks plain HTTP; TLS termination is the operator's responsibility.
- Keeping the host patched and the database backups encrypted.
- Restricting direct database access to the api host.

See `docs/SECURITY.md` for the full list of security controls and `docs/DEPLOYMENT.md` for the deployment runbook.

## Acknowledgements

- (no public acknowledgements yet — be the first)
