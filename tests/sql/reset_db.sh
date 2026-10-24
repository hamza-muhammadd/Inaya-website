#!/bin/bash
# Rebuilds a throwaway Postgres database with every migration, for tests. Usage: reset_db.sh [dbname]
DB=${1:-inaya_test}; export PGHOST=${PGHOST:-/tmp/pgdata} PGPORT=${PGPORT:-5544}; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
psql -U postgres -d postgres -q -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null || exit 1
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/stub_supabase.sql" || exit 1
for f in schema 002_students 003_classes 004_finance 005_attendance 006_users 007_website_builder 008_copy_cleanup 009_auto_translation 010_learning_platform 012_fix_certificate_code 013_student_journey; do
  [ -f "$ROOT/sql/$f.sql" ] || continue
  out=$(psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f "$ROOT/sql/$f.sql" 2>&1) || { echo "FAILED in $f.sql"; echo "$out" | head -8; exit 1; }
done
[ -f "$ROOT/sql/011_seed_quranic_excellence.sql" ] && { out=$(psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f "$ROOT/sql/011_seed_quranic_excellence.sql" 2>&1) || { echo "FAILED in 011"; echo "$out" | head -8; exit 1; }; }
echo "database $DB ready"
