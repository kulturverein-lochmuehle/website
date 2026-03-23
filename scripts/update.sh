#!/usr/bin/env bash

# Assuming having fnm installed from HEAD
# brew unlink fnm
# brew install fnm --HEAD
# eval "$(fnm env --use-on-cd --shell zsh)"

# Run a labeled step; on success collapse its output to a single line,
# on failure keep the full output visible and exit.
run_step() {
  local label="$1"; shift
  local output_file
  output_file=$(mktemp)
  trap "rm -f '$output_file'" RETURN

  printf '> %s ...' "$label"

  # Run command in subshell, capture output silently
  ("$@") > "$output_file" 2>&1
  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    printf '\r\033[2K\033[32m✓ %s\033[0m\n' "$label"
  else
    printf '\r\033[2K\033[31m✗ %s (exit code %d)\033[0m\n' "$label" "$exit_code"
    cat "$output_file"
    exit $exit_code
  fi
}

# Update node to latest version and update .node-version files
# > this requires fnm to be installed from HEAD, as the last stable
# > release is from 11/2024 not containing this flag yet
step() {
  fnm install --lts --use &&
  node -v > .node-version &&
  pnpm -r --parallel --aggregate-output --no-reporter-hide-prefix --shell-mode exec \
    'if [ -f .node-version ]; then node -v > .node-version; fi'
}; run_step "Updating Node.js to current LTS version" step

# Update all dependencies to latest version in all packages
step() {
  pnpm -r --parallel --aggregate-output --no-reporter-hide-prefix exec \
    pnpx npm-check-updates --dep dev,optional,peer,prod,packageManager --upgrade
}; run_step "Checking for latest versions of dependencies" step

# Align node types to installed node lts version
step() {
  NODE_VERSION=$(node -v) &&
  NODE_MAJOR_VERSION=${NODE_VERSION:1:2} &&
  pnpm -r update "@types/node@${NODE_MAJOR_VERSION}"
}; run_step "Aligning @types/node" step

# Install updated dependencies
step() {
  rm -rf node_modules &&
  pnpm self-update &&
  pnpm install
}; run_step "Installing updated dependencies" step

# Update GitHub Actions to latest versions
step() {
  pnpx actions-up --yes --include-branches
}; run_step "Updating GitHub Actions to latest versions" step
