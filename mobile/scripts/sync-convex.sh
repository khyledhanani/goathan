#!/bin/bash
# Copies Convex generated files from web/ to mobile/
# Run this after schema changes or adding new Convex functions
set -e
cd "$(dirname "$0")/.."
cp ../web/convex/_generated/api.js ../web/convex/_generated/api.d.ts \
   ../web/convex/_generated/dataModel.d.ts \
   ../web/convex/_generated/server.js ../web/convex/_generated/server.d.ts \
   convex/_generated/
echo "Convex generated files synced."
