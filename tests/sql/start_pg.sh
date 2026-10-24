#!/bin/bash
# Starts a local Postgres 16 on port 5544 for the SQL tests (needs the postgres OS user, e.g. in the Claude sandbox).
D=/tmp/pgdata
mkdir -p $D && chown postgres $D
[ -d $D/d ] || su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/d -A trust >/dev/null"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/d -o '-p 5544 -k $D' -l $D/log start" 2>&1 | tail -1
sleep 2
