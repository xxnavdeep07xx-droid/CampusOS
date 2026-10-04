#!/usr/bin/env bash
# CampusOS post-deploy smoke test.
#
#   ./scripts/smoke.sh https://your-domain.com
#   BASE_URL=http://localhost:3000 ./scripts/smoke.sh
#
# Exits non-zero if any public route or the health probe misbehaves.

set -uo pipefail

BASE="${1:-${BASE_URL:-http://localhost:3000}}"
fail=0

# check <path> <expected-code> <label>
check() {
  local path="$1" expected="$2" label="$3"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$BASE$path" || echo "000")
  if [ "$code" = "$expected" ]; then
    printf '  ✓ %-26s %s\n' "$path" "$code"
  else
    printf '  ✗ %-26s got %s, expected %s  (%s)\n' "$path" "$code" "$expected" "$label"
    fail=1
  fi
}

# check_any <path> <label> <code>...  — passes when the response is any of the
# accepted codes. Used for routes that redirect to /setup while the deployment
# has no Supabase credentials yet.
check_any() {
  local path="$1" label="$2"; shift 2
  local code accepted=0
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$BASE$path" || echo "000")
  for want in "$@"; do [ "$code" = "$want" ] && accepted=1; done
  if [ "$accepted" -eq 1 ]; then
    printf '  ✓ %-26s %s\n' "$path" "$code"
  else
    printf '  ✗ %-26s got %s, expected one of [%s]  (%s)\n' "$path" "$code" "$*" "$label"
    fail=1
  fi
}

echo "CampusOS smoke test → $BASE"
echo
echo "Public pages"
check /           200 "landing page"
check /privacy    200 "privacy policy"
check /terms      200 "terms of service"
check /sitemap.xml 200 "sitemap"
check /robots.txt  200 "robots"

echo
echo "Auth + guards"
# 200 when Supabase is configured, 307 → /setup when it is not.
check_any /login               "login page"                200 307
check_any /register/principal  "principal sign-up"         200 307
check /dashboard          307 "redirects to /login when signed out"

echo
echo "API"
check /api         200 "service index"
check /api/health  200 "health probe"
printf '  health body: '
curl -s -m 20 "$BASE/api/health" || true
echo

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "One or more checks failed."
fi
exit "$fail"
