---
"@anatolykoptev/krolik-cli": minor
---

feat(schema): Add filters, compact mode, and smart domain detection

**New features:**
- `--model <name>` - Filter by model name (partial match, case-insensitive)
- `--domain <name>` - Filter by domain name
- `--compact` - Compact output showing only model names and relations (86% size reduction)

**Improvements:**
- Dynamic domain inference from filenames (works with any schema structure)
- Foundation for smart relation-based domain detection (#28)
