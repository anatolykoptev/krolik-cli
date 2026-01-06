---
"@anatolykoptev/krolik-cli": minor
---

Add smart AI-optimized output formats for schema and routes commands

**Schema command:**
- New default smart format (-71% output size)
- Hides standard fields (id, createdAt, updatedAt)
- Hides obvious defaults (cuid, now, false, 0)
- Groups fields by importance: keys, data, meta
- Compact field notation: `name?`, `email!`, `status:BookingStatus`
- New `--compact` flag for minimal overview
- New `--full` flag for verbose legacy format

**Routes command:**
- New default smart format (-58% output size)
- Dynamic domain detection from file paths (37 domains vs 5 hardcoded)
- Groups procedures by type (queries/mutations) on single line
- Shows only unprotected as exceptions (75% are protected)
- New `--compact` flag for router counts only
- New `--full` flag for verbose legacy format

**CLI:**
- Added `--project` option to both schema and routes commands
