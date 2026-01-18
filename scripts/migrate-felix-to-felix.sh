#!/bin/bash
# Migration script: ralph → felix
# Krolik Felix - Multi-Tier AI Orchestration
# Usage: bash scripts/migrate-ralph-to-felix.sh

set -e

echo "🔄 Starting migration: ralph → felix"
echo "📦 Creating Krolik Felix - Multi-Tier AI Orchestration"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Rename directories
echo -e "${BLUE}Step 1: Renaming directories...${NC}"

if [ -d "src/lib/@ralph" ]; then
  git mv src/lib/@ralph src/lib/@felix 2>/dev/null || mv src/lib/@ralph src/lib/@felix
  echo -e "${GREEN}✓ src/lib/@ralph → src/lib/@felix${NC}"
fi

if [ -d "src/lib/@storage/ralph" ]; then
  git mv src/lib/@storage/ralph src/lib/@storage/felix 2>/dev/null || mv src/lib/@storage/ralph src/lib/@storage/felix
  echo -e "${GREEN}✓ src/lib/@storage/ralph → src/lib/@storage/felix${NC}"
fi

if [ -d "tests/@ralph" ]; then
  git mv tests/@ralph tests/@felix 2>/dev/null || mv tests/@ralph tests/@felix
  echo -e "${GREEN}✓ tests/@ralph → tests/@felix${NC}"
fi

if [ -d "src/commands/ralph" ]; then
  git mv src/commands/ralph src/commands/felix 2>/dev/null || mv src/commands/ralph src/commands/felix
  echo -e "${GREEN}✓ src/commands/ralph → src/commands/felix${NC}"
fi

if [ -d "src/mcp/tools/ralph" ]; then
  git mv src/mcp/tools/ralph src/mcp/tools/felix 2>/dev/null || mv src/mcp/tools/ralph src/mcp/tools/felix
  echo -e "${GREEN}✓ src/mcp/tools/ralph → src/mcp/tools/felix${NC}"
fi

if [ -d "docs/ralph-loop" ]; then
  git mv docs/ralph-loop docs/felix-loop 2>/dev/null || mv docs/ralph-loop docs/felix-loop
  echo -e "${GREEN}✓ docs/ralph-loop → docs/felix-loop${NC}"
fi

echo ""

# Step 2: Rename files
echo -e "${BLUE}Step 2: Renaming files...${NC}"

# Find and rename files containing 'ralph' in name
find . -depth \( -name "*ralph*.ts" -o -name "*ralph*.md" -o -name "*ralph*.sh" -o -name "*ralph*.json" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" | while read file; do
  newfile=$(echo "$file" | sed 's/ralph/felix/g')
  if [ "$file" != "$newfile" ] && [ -e "$file" ]; then
    git mv "$file" "$newfile" 2>/dev/null || mv "$file" "$newfile"
    echo -e "${GREEN}✓ $file → $newfile${NC}"
  fi
done

echo ""

# Step 3: Replace content in files
echo -e "${BLUE}Step 3: Replacing content in files...${NC}"

# Files to process
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o -name "*.yaml" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.git/*" \
  -not -path "*/pnpm-lock.yaml" \
  -not -path "*/scripts/migrate-ralph-to-felix.sh")

# Replacements to make
declare -A REPLACEMENTS=(
  # Directories & imports
  ["@ralph"]="@felix"
  ["@storage/ralph"]="@storage/felix"

  # Class names
  ["RalphOrchestrator"]="FelixOrchestrator"
  ["RalphExecutor"]="FelixExecutor"
  ["RalphLoopEvent"]="FelixLoopEvent"
  ["RalphLoopState"]="FelixLoopState"
  ["RalphLoopEventHandler"]="FelixLoopEventHandler"
  ["RalphOrchestratorConfig"]="FelixOrchestratorConfig"

  # Database tables
  ["ralph_sessions"]="felix_sessions"
  ["ralph_attempts"]="felix_attempts"
  ["ralph_routing_patterns"]="felix_routing_patterns"
  ["ralph_guardrails"]="felix_guardrails"

  # CLI commands
  ["krolik ralph"]="krolik felix"
  ["krolik_ralph"]="krolik_felix"

  # Type names
  ["PRDRalph"]="PRDFelix"

  # File/directory references
  ["ralph-loop"]="felix-loop"
  ["ralph/"]="felix/"

  # Comments & docs
  ["Ralph Loop"]="Felix Loop"
  ["Ralph loop"]="Felix loop"
  ["Ralph Wiggum"]="Felix (autonomous AI orchestration)"
  ["RALPH"]="FELIX"

  # Functions & variables (lowercase)
  ["ralphExecutor"]="felixExecutor"
  ["ralphOrchestrator"]="felixOrchestrator"
  ["ralphConfig"]="felixConfig"

  # MCP tools
  ["krolik-ralph"]="krolik-felix"
)

# Apply replacements
for find in "${!REPLACEMENTS[@]}"; do
  replace="${REPLACEMENTS[$find]}"
  echo -e "${YELLOW}Replacing: '$find' → '$replace'${NC}"

  # Use perl for in-place replacement (works on macOS)
  for file in $FILES; do
    if [ -f "$file" ]; then
      perl -pi -e "s/\Q$find\E/$replace/g" "$file" 2>/dev/null || true
    fi
  done
done

echo -e "${GREEN}✓ Content replacement complete${NC}"
echo ""

# Step 4: Update package.json
echo -e "${BLUE}Step 4: Updating package.json...${NC}"

if [ -f "package.json" ]; then
  # Update description
  perl -pi -e 's/"description": "KROLIK — fast AI-assisted development toolkit.*"/"description": "Krolik Felix — Multi-Tier AI Orchestration for cost-optimized development"/' package.json

  # Check for remaining ralph references
  if grep -q "ralph" package.json; then
    echo -e "${YELLOW}⚠ Found 'ralph' references in package.json - review manually${NC}"
  else
    echo -e "${GREEN}✓ package.json updated${NC}"
  fi
fi

echo ""

# Step 5: Update PRD files
echo -e "${BLUE}Step 5: Updating PRD files...${NC}"

for prd in PRD*.json; do
  if [ -f "$prd" ]; then
    perl -pi -e 's/ralph/felix/g' "$prd"
    perl -pi -e 's/Ralph/Felix/g' "$prd"
    echo -e "${GREEN}✓ Updated $prd${NC}"
  fi
done

echo ""

# Step 6: Update README
echo -e "${BLUE}Step 6: Updating README...${NC}"

if [ -f "README.md" ]; then
  # Add Felix branding
  perl -pi -e 's/KROLIK — fast AI-assisted development toolkit/Krolik Felix — Multi-Tier AI Orchestration/' README.md
  echo -e "${GREEN}✓ README.md updated${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Migration complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Krolik Felix - Multi-Tier AI Orchestration${NC}"
echo -e "${BLUE}Success through intelligent orchestration${NC}"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Build project: pnpm build"
echo "3. Run tests: pnpm test"
echo "4. Update database: Run SQL migration for table renames"
echo "5. Commit: git add . && git commit -m 'refactor: rename ralph to felix - introduce Krolik Felix'"
echo ""
