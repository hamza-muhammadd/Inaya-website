#!/bin/bash
# Usage: tests/sql/run.sh  (starts Postgres if needed, rebuilds the test database, runs the learning tests)
cd "$(dirname "$0")"; export PGHOST=/tmp/pgdata PGPORT=5544
pg_isready -q || ./start_pg.sh
./reset_db.sh inaya_test | tail -1 || exit 1
psql -U postgres -d inaya_test -X -q -t -A -f learning.test.sql 2>&1 | grep -v "^$"
