#!/bin/bash
# Migration script: ralph → lumis
# Usage: bash scripts/migrate-ralph-to-lumis.sh

set -e

echo "🔄 Starting migration: ralph → lumis"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Rename directories
echo -e "${BLUE}Step 1: Renaming directories...${NC}"

if [ -d "src/lib/@ralph" ]; then
  git mv src/lib/@ralph src/lib/@lumis
  echo -e "${GREEN}✓ src/lib/@ralph → src/lib/@lumis${NC}"
fi

if [ -d "src/lib/@storage/ralph" ]; then
  git mv src/lib/@storage/ralph src/lib/@storage/lumis
  echo -e "${GREEN}✓ src/lib/@storage/ralph → src/lib/@storage/lumis${NC}"
fi

if [ -d "tests/@ralph" ]; then
  git mv tests/@ralph tests/@lumis
  echo -e "${GREEN}✓ tests/@ralph → tests/@lumis${NC}"
fi

if [ -d "src/commands/ralph" ]; then
  git mv src/commands/ralph src/commands/lumis
  echo -e "${GREEN}✓ src/commands/ralph → src/commands/lumis${NC}"
fi

if [ -d "src/mcp/tools/ralph" ]; then
  git mv src/mcp/tools/ralph src/mcp/tools/lumis
  echo -e "${GREEN}✓ src/mcp/tools/ralph → src/mcp/tools/lumis${NC}"
fi

if [ -d "docs/ralph-loop" ]; then
  git mv docs/ralph-loop docs/lumis-loop
  echo -e "${GREEN}✓ docs/ralph-loop → docs/lumis-loop${NC}"
fi

echo ""

# Step 2: Rename files
echo -e "${BLUE}Step 2: Renaming files...${NC}"

# Find and rename files containing 'ralph' in name
find . -depth -name "*ralph*.ts" -o -name "*ralph*.md" -o -name "*ralph*.sh" | while read file; do
  newfile=$(echo "$file" | sed 's/ralph/lumis/g')
  if [ "$file" != "$newfile" ]; then
    git mv "$file" "$newfile" 2>/dev/null || mv "$file" "$newfile"
    echo -e "${GREEN}✓ $file → $newfile${NC}"
  fi
done

echo ""

# Step 3: Replace content in files
echo -e "${BLUE}Step 3: Replacing content in files...${NC}"

# Files to process
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.git/*" \
  -not -path "*/pnpm-lock.yaml")

# Replacements to make
declare -A REPLACEMENTS=(
  # Directories & imports
  ["@ralph"]="@lumis"
  ["@storage/ralph"]="@storage/lumis"

  # Class names
  ["RalphOrchestrator"]="LumisOrchestrator"
  ["RalphExecutor"]="LumisExecutor"
  ["RalphLoopEvent"]="LumisLoopEvent"
  ["RalphLoopState"]="LumisLoopState"
  ["RalphLoopEventHandler"]="LumisLoopEventHandler"
  ["RalphOrchestratorConfig"]="LumisOrchestratorConfig"

  # Database tables
  ["ralph_sessions"]="lumis_sessions"
  ["ralph_attempts"]="lumis_attempts"
  ["ralph_routing_patterns"]="lumis_routing_patterns"
  ["ralph_guardrails"]="lumis_guardrails"

  # CLI commands
  ["krolik ralph"]="krolik lumis"
  ["krolik_ralph"]="krolik_lumis"

  # Type names
  ["PRDRalph"]="PRDLumis"

  # File/directory references
  ["ralph-loop"]="lumis-loop"
  ["ralph/"]="lumis/"

  # Comments & docs (case sensitive)
  ["Ralph Loop"]="Lumis Loop"
  ["Ralph loop"]="Lumis loop"
  ["RALPH"]="LUMIS"

  # Functions & variables (lowercase)
  ["ralphExecutor"]="lumisExecutor"
  ["ralphOrchestrator"]="lumisOrchestrator"
  ["ralphConfig"]="lumisConfig"
)

# Apply replacements
for find in "${!REPLACEMENTS[@]}"; do
  replace="${REPLACEMENTS[$find]}"
  echo -e "${YELLOW}Replacing: '$find' → '$replace'${NC}"

  # Use perl for in-place replacement (works on macOS)
  echo "$FILES" | xargs perl -pi -e "s/\Q$find\E/$replace/g" 2>/dev/null || true
done

echo -e "${GREEN}✓ Content replacement complete${NC}"
echo ""

# Step 4: Update package.json scripts
echo -e "${BLUE}Step 4: Checking package.json...${NC}"

if grep -q "ralph" package.json; then
  echo -e "${YELLOW}⚠ Found 'ralph' references in package.json - review manually${NC}"
else
  echo -e "${GREEN}✓ package.json is clean${NC}"
fi

echo ""

# Step 5: Update PRD files
echo -e "${BLUE}Step 5: Updating PRD files...${NC}"

for prd in PRD*.json; do
  if [ -f "$prd" ]; then
    perl -pi -e 's/ralph/lumis/g' "$prd"
    echo -e "${GREEN}✓ Updated $prd${NC}"
  fi
done

echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Migration complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Run tests: pnpm test"
echo "3. Update database: Run migration script"
echo "4. Commit: git add . && git commit -m 'refactor: rename ralph to lumis'"
echo ""
