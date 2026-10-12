# MerchantOS — Pricing & Sustainability

This document is about how MerchantOS is intended to be funded, distributed,
and sustained. It is **not** a product pricing page; MerchantOS itself is
free and self-hosted.

## The license

MerchantOS source code is licensed under the **AGPL-3.0**. This means:

- You can use it for free, including commercially.
- You can modify it, also for free.
- If you **distribute** a modified version (including as a hosted service),
  you **must publish your modifications** under the same license.

The intent is to prevent a third party from taking the code, rebranding it,
and selling it as a closed product, while still allowing merchants and
integrators to use it freely.

## What MerchantOS does not charge for

- The software.
- The database.
- The web UI.
- The API.
- The backup/restore scripts.
- The threat model documentation.
- The deployment guide.

Everything in this repository is free of charge. There is no "pro" or
"enterprise" tier of the software.

## What an operator pays for

- **A host** — a Linux VM, a Raspberry Pi, a NUC, a Kubernetes cluster.
  The smallest viable setup is 1 vCPU, 1 GB RAM, 20 GB disk.
- **PostgreSQL** — bundled with most Linux distros; otherwise a managed
  instance costs ~$10-30 / month.
- **A domain name** — ~$10 / year.
- **TLS certificates** — free via Let's Encrypt.
- **A payment provider** (if you choose to use one) — transaction fees
  are set by the provider, not by MerchantOS. The default in-repo
  simulator is free; real payments are not.
- **Optional AI** — a local Ollama install is free; a hosted LLM API is
  priced by the provider.

## What an integrator/agency charges for

A typical MerchantOS deployment, done by a third-party integrator, costs
~$1,000 - $5,000 (one-time) for a single-store setup and ongoing
maintenance. This is the integrator's work, not a MerchantOS fee.

## Sponsorship

The project accepts sponsorship from:

- **Merchants** who depend on it and want it to keep working.
- **Agencies** who deploy it and want shared infrastructure improvements.
- **Cloud providers** who want to publish a reference deployment.

Sponsorship tiers (subject to change):
- $50 / month — listed as a supporter in the README.
- $250 / month — your logo in the README + private support channel.
- $1,000 / month — quarterly roadmap call + priority issue triage.

(Sponsorships do not buy feature priority. Features are prioritized on user
impact and effort, not on sponsorship size. This is a hard line.)

## What sponsorship pays for

- Domain and hosting for the demo deployment.
- Code review time.
- Security audit fees.
- Infrastructure for the CI runners.
- The maintainer's time, eventually, if the project becomes self-sustaining.

## What is explicitly not done

- **No telemetry.** No "phone home" to a vendor. The only network calls
  the API makes are to its database and (optionally) to a payment
  provider webhook, both of which the operator configures.
- **No "free trial" nag screens.** There is no upsell because there is
  nothing to upsell to.
- **No usage caps.** The software runs as fast as your hardware allows.
- **No "premium support" tier.** Best-effort community support on GitHub
  Discussions. For guaranteed response times, hire an integrator.

## For merchants evaluating MerchantOS

If you are a merchant reading this, the right question is not "is it
free?" (it is) but "is it the right tool for my business?". Read
`docs/ARCHITECTURE.md` for the technical shape, the threat model
(`docs/THREAT_MODEL.md`) for what it does and does not protect, and the
deployment guide (`docs/DEPLOYMENT.md`) for what it takes to run. Then
decide.
