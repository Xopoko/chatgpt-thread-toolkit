#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"
extension_dir="$repo_root/extension"
manifest_path="$extension_dir/manifest.json"
output_path="${1:-}"
staging_dir=""

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ -n "$staging_dir" && -d "$staging_dir" ]]; then
    rm -rf "$staging_dir"
  fi
}

read_manifest_version() {
  local path="$1"

  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("fs");
      const manifestPath = process.argv[1];
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (typeof manifest.version !== "string" || manifest.version.length === 0) {
        process.exit(1);
      }
      process.stdout.write(manifest.version);
    ' "$path"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

version = manifest.get("version")
if not isinstance(version, str) or not version:
    raise SystemExit(1)

sys.stdout.write(version)
' "$path"
    return
  fi

  fail "Could not read manifest version: neither node nor python3 is available."
}

trap cleanup EXIT

[[ -f "$manifest_path" ]] || fail "Could not find manifest.json at $manifest_path"
command -v zip >/dev/null 2>&1 || fail "Could not find required 'zip' command in PATH."

manifest_version="$(read_manifest_version "$manifest_path")" || fail "Could not read extension version from $manifest_path"

if [[ -z "$output_path" ]]; then
  output_dir="$repo_root/output"
  mkdir -p "$output_dir"
  output_path="$output_dir/chatgpt-thread-toolkit-extension-v${manifest_version}.zip"
fi

mkdir -p "$(dirname "$output_path")"
resolved_output_dir="$(cd "$(dirname "$output_path")" && pwd -P)"
resolved_output_path="$resolved_output_dir/$(basename "$output_path")"

staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/chatgpt-thread-toolkit-extension.XXXXXX")"
cp -R "$extension_dir"/. "$staging_dir"/
find "$staging_dir" \( -name '.DS_Store' -o -name '__MACOSX' \) -prune -exec rm -rf {} +

rm -f "$resolved_output_path"
(
  cd "$staging_dir"
  zip -qr "$resolved_output_path" .
)

printf '%s\n' "$resolved_output_path"
