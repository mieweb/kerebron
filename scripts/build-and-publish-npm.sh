#!/usr/bin/env bash
#
# Build and publish NPM packages for @kerebron
#
# Usage:
#   ./scripts/build-and-publish-npm.sh [version]        # Build only (dry run)
#   ./scripts/build-and-publish-npm.sh [version] --publish  # Build and publish
#
# Examples:
#   ./scripts/build-and-publish-npm.sh 1.0.0            # Build v1.0.0
#   ./scripts/build-and-publish-npm.sh v1.0.0 --publish # Build and publish v1.0.0
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
VERSION="${1:-}"
PUBLISH=false

if [[ "${2:-}" == "--publish" ]]; then
    PUBLISH=true
fi

# Validate version
if [[ -z "$VERSION" ]]; then
    echo -e "${RED}Error: Version argument is required${NC}"
    echo "Usage: $0 <version> [--publish]"
    echo "Example: $0 1.0.0 --publish"
    exit 1
fi

# Strip leading 'v' if present for consistency
VERSION="${VERSION#v}"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  @kerebron NPM Build & Publish${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Version: ${GREEN}$VERSION${NC}"
echo -e "Publish: ${PUBLISH}"
echo -e "Project: ${PROJECT_ROOT}"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Clean the npm output directory
echo -e "${YELLOW}[1/4] Cleaning npm output directory...${NC}"
rm -rf ./npm
echo -e "${GREEN}✓ Cleaned npm directory${NC}"

# Step 2: Build WASM package (if applicable)
echo -e "${YELLOW}[2/4] Building WASM package...${NC}"
if deno task -f @kerebron/odt-wasm build; then
    echo -e "${GREEN}✓ WASM build complete${NC}"
else
    echo -e "${RED}✗ WASM build failed${NC}"
    exit 1
fi

# Step 3: Build example-vue (if needed for assets)
echo -e "${YELLOW}[3/4] Building example-vue...${NC}"
if deno task -f example-vue build; then
    echo -e "${GREEN}✓ example-vue build complete${NC}"
else
    echo -e "${RED}✗ example-vue build failed${NC}"
    exit 1
fi

# Step 4: Build all NPM packages
echo -e "${YELLOW}[4/4] Building NPM packages...${NC}"
if deno run -A ./build/build_npm.ts "$VERSION"; then
    echo -e "${GREEN}✓ NPM packages built successfully${NC}"
else
    echo -e "${RED}✗ NPM package build failed${NC}"
    exit 1
fi

# List built packages
echo ""
echo -e "${BLUE}Built packages:${NC}"
PACKAGE_COUNT=0
for DIR in npm/*/* ; do
    if [[ -d "$DIR" && -f "$DIR/package.json" ]]; then
        PKG_NAME=$(jq -r '.name' "$DIR/package.json")
        PKG_VERSION=$(jq -r '.version' "$DIR/package.json")
        echo -e "  ${GREEN}✓${NC} $PKG_NAME@$PKG_VERSION"
        PACKAGE_COUNT=$((PACKAGE_COUNT + 1))
    fi
done
echo ""
echo -e "Total packages: ${GREEN}$PACKAGE_COUNT${NC}"

# Publish if requested
if [[ "$PUBLISH" == "true" ]]; then
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Publishing to NPM${NC}"
    echo -e "${BLUE}======================================${NC}"
    
    PUBLISHED=0
    FAILED=0
    
    for DIR in npm/*/* ; do
        if [[ -d "$DIR" && -f "$DIR/package.json" ]]; then
            PKG_NAME=$(jq -r '.name' "$DIR/package.json")
            echo -e "${YELLOW}Publishing $PKG_NAME...${NC}"
            
            cd "$DIR"
            if npm publish --access=public; then
                echo -e "${GREEN}✓ Published $PKG_NAME${NC}"
                PUBLISHED=$((PUBLISHED + 1))
            else
                echo -e "${RED}✗ Failed to publish $PKG_NAME${NC}"
                FAILED=$((FAILED + 1))
                cd "$PROJECT_ROOT"
                exit 1
            fi
            cd "$PROJECT_ROOT"
        fi
    done
    
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  All $PUBLISHED packages published!${NC}"
    echo -e "${GREEN}======================================${NC}"
else
    echo ""
    echo -e "${YELLOW}======================================${NC}"
    echo -e "${YELLOW}  Dry run complete (no publish)${NC}"
    echo -e "${YELLOW}  Run with --publish to publish${NC}"
    echo -e "${YELLOW}======================================${NC}"
fi
