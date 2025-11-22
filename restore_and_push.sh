#!/usr/bin/env bash
set -euo pipefail

# restore_and_push.sh
# Safe helper to:
# 1) create a timestamped backup of origin/main
# 2) push back local branches that were removed remotely
# 3) restore origin/main to a known previous backup if available locally
# 4) ensure `features/ADDED-pay-not-working` exists on origin
# By default this script will NOT overwrite origin/main with your cleaned branch.
# Use --force-cleaned-main to replace main with `clean/features-ADDED-pay-not-working`.

FORCE_CLEANED_MAIN=0
if [ "${1:-}" = "--force-cleaned-main" ]; then
  FORCE_CLEANED_MAIN=1
fi

echo "Working directory: $(pwd)"

echo "Fetching origin..."
git fetch origin --prune

TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_REF="backup/pre-restore-$TS"

echo "Creating local backup ref $BACKUP_REF -> origin/main"
git branch -f "$BACKUP_REF" origin/main

echo "Pushing backup ref to remote: $BACKUP_REF"
git push origin "$BACKUP_REF":refs/heads/"$BACKUP_REF" || {
  echo "Warning: push of backup ref failed; check network/credentials.";
}

# Push back local branches if present
BRANCHES=("features/ADDED-pay-not-working" "fix/auth-headers" "polish/single-commit")
for BR in "${BRANCHES[@]}"; do
  if git show-ref --verify --quiet refs/heads/$BR; then
    if [ "$BR" = "polish/single-commit" ]; then
      echo "Pushing local $BR -> origin/polished/main"
      git push origin $BR:refs/heads/polished/main || echo "push $BR -> polished/main failed, continuing"
    else
      echo "Pushing local $BR -> origin/$BR"
      git push origin $BR:refs/heads/$BR || echo "push $BR failed, continuing"
    fi
  else
    echo "Local ref $BR not found; skipping"
  fi
done

# If features branch missing locally, try to load from bundle
if ! git show-ref --verify --quiet refs/heads/features/ADDED-pay-not-working; then
  if [ -f features-ADDED-pay-not-working.bundle ]; then
    echo "Local branch features/ADDED-pay-not-working not found; fetching from bundle"
    git bundle verify features-ADDED-pay-not-working.bundle || true
    git fetch features-ADDED-pay-not-working.bundle refs/heads/*:refs/heads/* || true
    git push origin features/ADDED-pay-not-working:refs/heads/features/ADDED-pay-not-working || true
  fi
fi

# Restore origin/main to the earlier backup if available locally
RESTORE_REF="backup/main-before-fix-20251121-232041"
if git show-ref --verify --quiet refs/heads/$RESTORE_REF; then
  echo "Restoring origin/main to local $RESTORE_REF (force push)"
  git push --force origin $RESTORE_REF:refs/heads/main || {
    echo "Failed to restore origin/main -> $RESTORE_REF"; exit 1;
  }
  echo "origin/main restored to $RESTORE_REF"
else
  echo "Local restore ref $RESTORE_REF not present; skipping automatic main restore."
fi

# Ensure user's branch exists remotely
if git show-ref --verify --quiet refs/heads/features/ADDED-pay-not-working; then
  echo "Ensuring origin/features/ADDED-pay-not-working exists"
  git push origin features/ADDED-pay-not-working:refs/heads/features/ADDED-pay-not-working || echo "push features/ADDED-pay-not-working failed"
fi

# Optionally force main to cleaned branch
if [ "$FORCE_CLEANED_MAIN" -eq 1 ]; then
  CLEAN_BRANCH="clean/features-ADDED-pay-not-working"
  if git show-ref --verify --quiet refs/heads/$CLEAN_BRANCH; then
    echo "Force-pushing $CLEAN_BRANCH -> origin/main"
    git push --force origin $CLEAN_BRANCH:main || { echo "Failed to force-push cleaned branch to main"; exit 1; }
    echo "origin/main now points to $CLEAN_BRANCH"
  else
    echo "Cleaned branch $CLEAN_BRANCH not found locally; cannot replace main."
    exit 1
  fi
fi

echo "--- Remote heads (filtered) ---"
git ls-remote --heads origin | egrep "(refs/heads/main|features/ADDED-pay-not-working|fix/auth-headers|polished/main|backup/pre-restore-|backup/main-before-fix-20251121-232041|clean/main-preview)" || true

echo "Done. If you want to force main to your cleaned branch, run: ./restore_and_push.sh --force-cleaned-main"
