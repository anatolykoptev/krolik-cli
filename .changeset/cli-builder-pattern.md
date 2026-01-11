---
"@anatolykoptev/krolik-cli": minor
---

### CLI Architecture Refactoring

- **Builder Pattern**: New `builders/` module with reusable option builders:
  - `addProjectOption` - Multi-project workspace support
  - `addPathOption` - Path filtering
  - `addModeSwitch` - Quick/deep mode switches
  - `addDryRunOption`, `addForceOption` - Action modifiers

- **Parsers Module**: New `parsers/` module with centralized parsing utilities:
  - `parseMode` - Mode option parsing
  - `resolveOutputFormat` - Output format resolution
  - `parseIntOption`, `parseStringArray` - Common parsers

- **Unified Types**: Expanded `types.ts` with comprehensive CLI type definitions

- **Command Migration**: All 18 command files now use builder pattern

- **Removed**: Deprecated `quality` command (use `audit` instead)

- **Improved**: Duplicate detection with architectural pattern awareness
