-- Run only during the approved cut, with ingress and backend/scheduler stopped,
-- after a verified logical backup. Test on an isolated restore first.
-- No tokens are returned or written to a persistent mapping table.
\set ON_ERROR_STOP on
\set ECHO none
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.partida, public.mesa, public.sesion_jugador, public.jugador
    IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
    IF EXISTS (SELECT 1 FROM public.partida WHERE estado IN
        ('PLACING_SHIPS', 'READY_TO_START', 'IN_PROGRESS', 'EN_CURSO'))
        OR EXISTS (SELECT 1 FROM public.mesa WHERE ready_deadline_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Active game or ready deadline: session rotation refused';
    END IF;
END;
$guard$;

CREATE TEMP TABLE session_token_rotation (
    old_token text PRIMARY KEY,
    new_token text NOT NULL UNIQUE
) ON COMMIT DROP;
INSERT INTO session_token_rotation (old_token, new_token)
SELECT old_token,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
FROM (
    SELECT token AS old_token FROM public.sesion_jugador
    UNION
    SELECT session_token FROM public.jugador WHERE session_token IS NOT NULL
) existing_tokens;

UPDATE public.jugador j SET session_token = r.new_token
FROM session_token_rotation r WHERE j.session_token = r.old_token;
UPDATE public.sesion_jugador s SET token = r.new_token
FROM session_token_rotation r WHERE s.token = r.old_token;

DO $verify$
BEGIN
    IF EXISTS (SELECT 1 FROM public.sesion_jugador s
        JOIN session_token_rotation r ON s.token = r.old_token)
        OR EXISTS (SELECT 1 FROM public.jugador j
        JOIN session_token_rotation r ON j.session_token = r.old_token) THEN
        RAISE EXCEPTION 'Old credentials remain: session rotation rolled back';
    END IF;
END;
$verify$;

SELECT count(*) AS revoked_sessions FROM public.sesion_jugador \gset
SELECT count(*) AS rotated_tokens FROM session_token_rotation \gset
COMMIT;
SELECT json_build_object('status', 'committed',
    'revoked_sessions', :revoked_sessions, 'rotated_tokens', :rotated_tokens);
