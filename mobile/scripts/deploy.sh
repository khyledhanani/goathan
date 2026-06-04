#!/bin/bash
# Build and submit to TestFlight
set -e
cd "$(dirname "$0")/.."

# Sync latest Convex generated files
./scripts/sync-convex.sh

# Build and submit
eas build --platform ios --profile production --auto-submit
