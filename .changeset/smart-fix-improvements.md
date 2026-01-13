---
"@anatolykoptev/krolik-cli": minor
---

Smarter fix command with context-aware analysis

### Console analyzer improvements
- Context-aware classification: distinguishes debug logging from error handling
- Skips `console.error`/`console.warn` in catch blocks and error handlers
- Recognizes structured logging patterns (logger, winston, pino, bunyan)
- Different severity levels: debug → warning (auto-fix), error in handler → info (review)

### Magic numbers analyzer improvements
- Smart constant name suggestions based on value patterns
- Time values: `86400000` → `ONE_DAY_MS`, `5000` → `FIVE_SECONDS_MS`
- File sizes: `1048576` → `ONE_MB`, `5242880` → `FIVE_MB`
- Context-aware names: `setTimeout(fn, 3000)` → `DELAY_3000MS`
