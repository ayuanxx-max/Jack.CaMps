#!/usr/bin/env bash
# dsh-session-accordion — POSIX installer (Linux / macOS).
#
# Usage:
#   bash scripts/install.sh [--profile <name>] [--dry-run] [--apply]
#
#   --profile <name>  DSH profile to install into. Default: $DSH_PROFILE,
#                     else "web" when that profile exists, else "desktop".
#   --dry-run         Print what would happen, change nothing.
#   --apply           Also patch the profile package.json (needs `node`).
#
# The script only creates a symlink in <profile>/node_modules; it never copies
# the repository, so `git pull` + a DSH restart is enough to upgrade.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="${DSH_PROFILE:-}"
DRY_RUN=0
APPLY=0
PKG_NAME="dsh-session-accordion"

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --apply) APPLY=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$PROFILE" ]; then
  if [ -d "$DSH_HOME/profiles/web" ]; then PROFILE="web"
  elif [ -d "$DSH_HOME/profiles/desktop" ]; then PROFILE="desktop"
  else echo "cannot detect a DSH profile under $DSH_HOME/profiles; pass --profile <name>" >&2; exit 1
  fi
fi

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PKG_JSON="$PROFILE_DIR/package.json"
LINK="$PROFILE_DIR/node_modules/$PKG_NAME"

[ -d "$PROFILE_DIR" ] || { echo "profile not found: $PROFILE_DIR" >&2; exit 1; }
[ -f "$PKG_JSON" ] || { echo "package.json not found: $PKG_JSON" >&2; exit 1; }

echo "repo    : $REPO"
echo "profile : $PROFILE ($PROFILE_DIR)"
echo "link    : $LINK"

if [ "$DRY_RUN" = "1" ]; then
  echo "--dry-run: nothing was changed"
  exit 0
fi

mkdir -p "$PROFILE_DIR/node_modules"
if [ -L "$LINK" ] || [ -e "$LINK" ]; then
  echo "replacing existing $LINK"
  rm -rf "$LINK"
fi
ln -sfn "$REPO" "$LINK"
echo "symlink created"

if [ "$APPLY" = "1" ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "warning: node not found on PATH; patch $PKG_JSON by hand (see notes below)" >&2
  else
    cp "$PKG_JSON" "$PKG_JSON.bak-before-accordion"
    node - "$PKG_JSON" "$REPO" "$PKG_NAME" <<'NODE'
const fs = require('fs');
const [file, repo, name] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies[name] = 'link:' + repo;
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
const bundles = new Set(pkg.dsh.profile.bundles || []);
bundles.add(name);
pkg.dsh.profile.bundles = Array.from(bundles);
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('package.json patched (backup: ' + file + '.bak-before-accordion)');
NODE
  fi
fi

cat <<'NOTE'

Next steps:
  1. Add the bundle to the profile when --apply was not used:
       dependencies:      "dsh-session-accordion": "link:<repo path>"
       dsh.profile.bundles: "dsh-session-accordion"
  2. Restart DSH completely (profile-layer change; refreshing the page is not enough).
  3. Settings -> Chat -> "When to collapse work details" = On completion.
  4. Diagnostics: open DevTools and run __acReport().
NOTE
