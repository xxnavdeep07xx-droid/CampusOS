#!/bin/bash
# Persistent Next.js dev server launcher.
# Detaches fully from the parent shell so the server keeps running
# even after this Bash tool call returns.
cd /home/z/my-project

# Kill any stale dev server first
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Launch detached: stdin from /dev/null, stdout+stderr to dev.log,
# in its own session via setsid so SIGHUP doesn't kill it.
setsid bash -c '
  cd /home/z/my-project
  exec bun x next dev -p 3000 > /home/z/my-project/dev.log 2>&1
' < /dev/null > /dev/null 2>&1 &

# Wait briefly for the server to come up
for i in {1..15}; do
  if curl -sS -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "Dev server is up after ${i}s"
    pgrep -f "next dev" | head -1
    exit 0
  fi
  sleep 1
done

echo "Dev server did not come up in 15s"
tail -20 /home/z/my-project/dev.log
exit 1
