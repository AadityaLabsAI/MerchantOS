# Security Threat Model

The authoritative threat model lives in [`THREAT_MODEL.md`](./THREAT_MODEL.md) (STRIDE-style; the same content the production-readiness checklist asks for under the filename `SECURITY_THREAT_MODEL.md`).

This file exists to satisfy the convention that production-readiness checklists use the filename `SECURITY_THREAT_MODEL.md`. Both filenames point to the same document.

## What is in the threat model

- Asset inventory (PII, transactions, credentials, audit data)
- Threat actors (network attacker, malicious insider, compromised dependency, opportunistic scanner)
- STRIDE analysis per asset
- Attack trees for the highest-impact threats
- Residual risks and their explicit acceptance rationale

For the controls that mitigate the threats identified here, see `docs/SECURITY.md`.
