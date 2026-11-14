#!/usr/bin/env bash
# Builds the game and publishes dist/ to the gh-pages branch, which GitHub
# Pages serves. The branch holds only the latest build and is replaced each time.
set -euo pipefail
cd "$(dirname "$0")/.."

remote=$(git remote get-url origin)
commit=$(git rev-parse --short HEAD)
name=$(git config user.name)
email=$(git config user.email)

npm test
npm run build
touch dist/.nojekyll

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m "Deploy $commit"
git push -q -f "$remote" gh-pages
rm -rf .git
echo "Published $commit to gh-pages"
