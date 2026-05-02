# Third-Party Notices

This repository is source-available for noncommercial use under the PolyForm
Noncommercial License 1.0.0, except where third-party components or referenced
materials have their own licenses or rights status.

This file is an engineering notice, not legal advice.

## Direct Runtime Dependencies

| Component | Source | License / Rights Status | Use |
|-----------|--------|-------------------------|-----|
| iztro | https://github.com/SylarLong/iztro | MIT | Zi Wei Dou Shu chart engine |
| lunar-javascript | https://github.com/6tail/lunar-javascript | MIT | Lunar calendar, Ba Zi chart data, shensha, dayun/liunian data |
| lunar-python | https://pypi.org/project/lunar-python/ | MIT | Python lunar calendar dependency used by vendored Ba Zi integration |
| colorama | https://pypi.org/project/colorama/ | BSD-style | Python terminal color dependency used by vendored Ba Zi integration |
| bidict | https://pypi.org/project/bidict/ | MPL-2.0 | Python bidirectional map dependency used by vendored Ba Zi integration |

## Vendored Source

| Component | Source | License / Rights Status | Local Path | Notes |
|-----------|--------|-------------------------|------------|-------|
| china-testing/bazi | https://github.com/china-testing/bazi | No declared license found in the vendored copy during local review | `vendor/bazi/` | Kept in git intentionally for personal, research, and noncommercial use. Because the upstream copy does not declare a license, this repository does not sublicense that code or its bundled texts beyond any rights that actually apply. Downstream users should review the upstream project and obtain permissions if needed before reuse, redistribution, or commercial use. |

## Referenced Projects And Materials

| Component | Source | License / Rights Status | Use |
|-----------|--------|-------------------------|-----|
| jinchenma94/bazi-skill | https://github.com/jinchenma94/bazi-skill | MIT | Reference for agent skill structure and classical-methodology organization |

## Publication Notes

- The project-level PolyForm Noncommercial license applies only to this
  repository's original work unless a file says otherwise.
- Third-party packages retain their own license terms.
- `vendor/bazi/` is the main publication risk: it is source-available upstream
  but has no declared license in the local copy. It remains tracked because the
  project owner accepts this noncommercial-use risk.
- Generated reports are local/private outputs and are ignored by git.
