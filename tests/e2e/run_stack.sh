#!/bin/bash
# Fresh database + fixtures + PostgREST + bridge server for the browser end to end tests.
D="$(cd "$(dirname "$0")" && pwd)"
for f in /tmp/pgrst/rest.pid /tmp/pgrst/bridge.pid; do [ -f $f ] && kill $(cat $f) 2>/dev/null; done; sleep 0.5
"$D/../sql/reset_db.sh" inaya_test >/dev/null || exit 1
psql -U postgres -h /tmp/pgdata -p 5544 -d inaya_test -q -v ON_ERROR_STOP=1 -f "$D/fixtures.sql" || exit 1
/tmp/pgrst/postgrest "$D/pgrst.conf" > /tmp/pgrst/e2e.log 2>&1 &
echo $! > /tmp/pgrst/rest.pid
sleep 2
node "$D/server.js" > /tmp/pgrst/e2e_server.log 2>&1 &
echo $! > /tmp/pgrst/bridge.pid
sleep 1
curl -s -o /dev/null -w "postgrest %{http_code}\n" "http://localhost:3555/programs?limit=1"
curl -s -o /dev/null -w "bridge %{http_code}\n" http://localhost:4180/config.js
