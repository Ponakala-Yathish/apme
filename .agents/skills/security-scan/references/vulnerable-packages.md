# Vulnerable Packages Registry

Last updated: 2026-10-22

This file contains known vulnerable packages to scan for. Add new entries
as security advisories are published.

---

## GitHub Actions

### Trivy Actions

- **Packages**:
  - `aquasecurity/setup-trivy`
  - `aquasecurity/trivy-action`
- **Affected**: setup-trivy < 0.2.6, trivy-action < 0.35.0
- **Severity**: HIGH
- **Source**: Internal Security Advisory (2026-03)
- **Pattern**: `aquasecurity/setup-trivy|aquasecurity/trivy-action`
- **Remediation**: Upgrade to setup-trivy >= 0.2.6, trivy-action >= 0.35.0

### Checkmarx Actions

- **Packages**:
  - `checkmarx/kics-github-action`
  - `checkmarx/ast-github-action`
- **Affected**: All versions (evaluate before use)
- **Severity**: MEDIUM
- **Source**: Internal Security Advisory (2026-03)
- **Pattern**: `checkmarx/kics-github-action|checkmarx/ast-github-action`
- **Remediation**: Review usage and pin to audited SHA

---

## Python Packages

### LiteLLM

- **Package**: `litellm`
- **Affected**: 1.82.7, 1.82.8
- **Severity**: HIGH
- **Source**: Internal Security Advisory (2026-03)
- **Pattern**: `litellm`
- **Files**: `requirements*.txt`, `pyproject.toml`, `setup.py`
- **Remediation**: Upgrade to patched version or remove

### Python dependency advisories (October 2026)

These entries cover all 17 open Dependabot alerts returned for APME on
2026-10-22. GitHub still reports `urllib3` 2.7.0, while the existing lock
resolves 2.8.0; the floor below keeps that fix explicit in later resolutions.

#### virtualenv

- **Package**: `virtualenv`
- **Affected**: `< 21.14.9`
- **Severity**: HIGH (includes MEDIUM advisories)
- **Sources**:
  [GHSA-cw65-gx24-rc82](https://github.com/advisories/GHSA-cw65-gx24-rc82),
  [GHSA-43mp-35q3-x3fq](https://github.com/advisories/GHSA-43mp-35q3-x3fq),
  [GHSA-c978-59m8-c77v](https://github.com/advisories/GHSA-c978-59m8-c77v),
  [GHSA-vxj4-q4g9-crj7](https://github.com/advisories/GHSA-vxj4-q4g9-crj7),
  [GHSA-5vjq-rrrf-7h2q](https://github.com/advisories/GHSA-5vjq-rrrf-7h2q),
  [GHSA-c947-3pg5-gm8q](https://github.com/advisories/GHSA-c947-3pg5-gm8q),
  [GHSA-8rjx-v5ww-45pp](https://github.com/advisories/GHSA-8rjx-v5ww-45pp),
  [GHSA-p58f-9548-mpm2](https://github.com/advisories/GHSA-p58f-9548-mpm2),
  [GHSA-x78j-v8h9-3j2q](https://github.com/advisories/GHSA-x78j-v8h9-3j2q),
  [GHSA-94p9-xgh2-xp45](https://github.com/advisories/GHSA-94p9-xgh2-xp45),
  [GHSA-9h9j-4vrj-gf7g](https://github.com/advisories/GHSA-9h9j-4vrj-gf7g)
- **Pattern**: `virtualenv`
- **Files**: `pyproject.toml`, `uv.lock`, `ci/tox-requirements.txt`
- **Remediation**: Use `virtualenv >= 21.14.9`; CI pins 21.14.12 to match `uv.lock`.

#### Black

- **Package**: `black`
- **Affected**: `< 26.10.1`
- **Severity**: HIGH
- **Source**: [GHSA-cg8m-r9f2-5wm2](https://github.com/advisories/GHSA-cg8m-r9f2-5wm2)
- **Pattern**: `black`
- **Files**: `pyproject.toml`, `uv.lock`
- **Remediation**: Upgrade to `black >= 26.10.1`

#### certifi

- **Package**: `certifi`
- **Affected**: `< 2026.10.19`
- **Severity**: CRITICAL
- **Source**: [GHSA-6q48-6c7w-9gw2](https://github.com/advisories/GHSA-6q48-6c7w-9gw2)
- **Pattern**: `certifi`
- **Files**: `pyproject.toml`, `uv.lock`
- **Remediation**: Upgrade to `certifi >= 2026.10.19` and rebuild images that vendor its CA bundle

#### OpenTelemetry Python API

- **Package**: `opentelemetry-api`
- **Affected**: `<= 1.45.0`
- **Severity**: MEDIUM
- **Source**: [GHSA-xcq7-p3pf-p88h](https://github.com/advisories/GHSA-xcq7-p3pf-p88h)
- **Pattern**: `opentelemetry-api`
- **Files**: `pyproject.toml`, `uv.lock`
- **Remediation**: Upgrade to `opentelemetry-api >= 1.45.1`

#### urllib3

- **Package**: `urllib3`
- **Affected**: `>= 1.10.3, < 2.8.0` (the related APME lock entry is 2.8.0)
- **Severity**: HIGH (includes a MEDIUM advisory)
- **Source**: [GHSA-8988-9cw3-xx77](https://github.com/advisories/GHSA-8988-9cw3-xx77), [GHSA-vxq7-64xx-v4gw](https://github.com/advisories/GHSA-vxq7-64xx-v4gw), [GHSA-gh4c-6fx4-qh6g](https://github.com/advisories/GHSA-gh4c-6fx4-qh6g)
- **Pattern**: `urllib3`
- **Files**: `pyproject.toml`, `uv.lock`
- **Remediation**: Require `urllib3 >= 2.8.0`

---

## Go Modules

### Trivy

- **Package**: `github.com/aquasecurity/trivy`
- **Affected**: 0.69.4
- **Severity**: HIGH
- **Source**: Internal Security Advisory (2026-03)
- **Pattern**: `github.com/aquasecurity/trivy`
- **Files**: `go.mod`, `go.sum`
- **Remediation**: Upgrade to patched version

---

## npm Packages (undici)

### undici (8.x cache / CRLF advisories)

- **Package**: `undici`
- **Affected**: `>= 8.0.0, < 8.9.0`
- **Severity**: HIGH (cross-user cache disclosure); additional MEDIUM (CRLF, cookie injection, desync)
- **Source**: [GitHub Advisory Database](https://github.com/advisories) / Dependabot
- **Pattern**: `"undici":[[:space:]]*"[~^]?8\.[0-8]\.` (POSIX ERE for `grep -E`; misses some range forms)
- **Semver scan**: `python scripts/security_scan_npm.py frontend/package.json` (manifest ranges + lockfile resolved versions)
- **Fixtures**: `tests/fixtures/security_scan_npm/` (exact, caret, tilde, spaced comparators, lockfile)
- **Files**: `frontend/package.json`, `frontend/package-lock.json`
- **Notes**: Older jsdom (<29) expected undici 7.x and could break on undici 8.x `wrap-handler`. jsdom 29 works with undici 8.x (this repo: jsdom `^29.1.1` + undici `8.9.0` override).
- **Remediation**: Pin `undici` to `>=8.9.0` when on jsdom 29+, or `7.29.0` if stuck on a jsdom that requires undici 7.x

---

## npm Packages (Canister Worm)

Source: [JFrog Research](https://research.jfrog.com/post/canister-worm/)

These packages were compromised as part of the Canister worm supply chain
attack. Any installation should be treated as a security incident.

- **Severity**: CRITICAL
- **Remediation**: Remove immediately, audit for data exfiltration, rotate credentials

### @pypestream scope
- `@pypestream/floating-ui-dom`

### @leafnoise scope
- `@leafnoise/mirage`

### @opengov scope
- `@opengov/ppf-backend-types`
- `@opengov/form-renderer`
- `@opengov/qa-record-types-api`
- `@opengov/form-builder`
- `@opengov/ppf-eslint-config`
- `@opengov/form-utils`

### @virtahealth scope
- `@virtahealth/substrate-root`

### @airtm scope
- `@airtm/uuid-base32`

### @teale.io scope
- `@teale.io/eslint-config`

### @emilgroup scope
- `@emilgroup/setting-sdk`
- `@emilgroup/partner-portal-sdk`
- `@emilgroup/gdv-sdk-node`
- `@emilgroup/docxtemplater-util`
- `@emilgroup/accounting-sdk`
- `@emilgroup/task-sdk`
- `@emilgroup/setting-sdk-node`
- `@emilgroup/task-sdk-node`
- `@emilgroup/partner-sdk`
- `@emilgroup/numbergenerator-sdk-node`
- `@emilgroup/customer-sdk`
- `@emilgroup/commission-sdk`
- `@emilgroup/process-manager-sdk`
- `@emilgroup/changelog-sdk-node`
- `@emilgroup/document-sdk-node`
- `@emilgroup/commission-sdk-node`
- `@emilgroup/document-uploader`
- `@emilgroup/discount-sdk`
- `@emilgroup/discount-sdk-node`
- `@emilgroup/insurance-sdk`
- `@emilgroup/account-sdk`
- `@emilgroup/account-sdk-node`
- `@emilgroup/accounting-sdk-node`
- `@emilgroup/api-documentation`
- `@emilgroup/auth-sdk`
- `@emilgroup/auth-sdk-node`
- `@emilgroup/billing-sdk`
- `@emilgroup/billing-sdk-node`
- `@emilgroup/claim-sdk`
- `@emilgroup/claim-sdk-node`
- `@emilgroup/customer-sdk-node`
- `@emilgroup/document-sdk`
- `@emilgroup/gdv-sdk`
- `@emilgroup/insurance-sdk-node`
- `@emilgroup/notification-sdk-node`
- `@emilgroup/partner-portal-sdk-node`
- `@emilgroup/partner-sdk-node`
- `@emilgroup/payment-sdk`
- `@emilgroup/payment-sdk-node`
- `@emilgroup/process-manager-sdk-node`
- `@emilgroup/public-api-sdk`
- `@emilgroup/public-api-sdk-node`
- `@emilgroup/tenant-sdk`
- `@emilgroup/tenant-sdk-node`
- `@emilgroup/translation-sdk-node`

### Unscoped packages
- `eslint-config-ppf`
- `react-leaflet-marker-layer`
- `react-leaflet-cluster-layer`
- `react-autolink-text`
- `opengov-k6-core`
- `jest-preset-ppf`
- `cit-playwright-tests`
- `eslint-config-service-users`
- `babel-plugin-react-pure-component`
- `react-leaflet-heatmap-layer`

---

## Grep Patterns (for automated scanning)

```bash
# GitHub Actions
TRIVY_ACTIONS="aquasecurity/setup-trivy|aquasecurity/trivy-action"
CHECKMARX_ACTIONS="checkmarx/kics-github-action|checkmarx/ast-github-action"

# Python
PYTHON_VULNS="litellm|virtualenv|black|certifi|opentelemetry-api|urllib3"

# Go
GO_VULNS="github.com/aquasecurity/trivy"

# npm scopes (Canister worm)
NPM_SCOPES="@pypestream/|@leafnoise/|@opengov/|@virtahealth/|@airtm/|@teale\\.io/|@emilgroup/"

# npm unscoped (Canister worm)
NPM_UNSCOPED="eslint-config-ppf|react-leaflet-marker-layer|react-leaflet-cluster-layer|react-autolink-text|opengov-k6-core|jest-preset-ppf|cit-playwright-tests|eslint-config-service-users|babel-plugin-react-pure-component|react-leaflet-heatmap-layer"
```

For Python package patterns, inspect resolved versions in `uv.lock` against
the affected ranges above; a package-name match alone does not indicate that
the resolved version is vulnerable.

---

## Adding New Vulnerabilities

When adding a new vulnerability:

1. Add under the appropriate category (or create a new one)
2. Include all required fields:
   - **Package(s)**: Name(s) of affected package(s)
   - **Affected**: Version range or specific versions
   - **Severity**: CRITICAL, HIGH, MEDIUM, LOW
   - **Source**: URL or reference to advisory
   - **Pattern**: Grep-compatible regex pattern
   - **Remediation**: Clear action to take
3. Update the grep patterns section if needed
4. Update "Last updated" date at the top
5. Test the scan locally before committing
