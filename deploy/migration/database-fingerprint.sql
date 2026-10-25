-- Run inside the same exported snapshot as pg_dump for the source baseline.
SELECT format(
  'SELECT json_build_object(''table'', %L, ''rows'', count(*), ''content_md5'', md5(coalesce(string_agg(row_to_json(t)::text, E''\n'' ORDER BY row_to_json(t)::text COLLATE "C"), ''''))) FROM %I.%I t;',
  schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
