-- ============================================================
-- PART 3 — Scheduled publishing cron job
-- ============================================================
--
-- Run AFTER Vercel is deployed and env vars are set.
-- Replace:
--   YOUR_APP.vercel.app  → your production domain
--   YOUR_CRON_SECRET     → same value as CRON_SECRET in Vercel
--
-- Requires: pg_cron and pg_net extensions enabled.
-- ============================================================

SELECT cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_APP.vercel.app/api/cron/publish',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify:
-- SELECT jobid, jobname, schedule FROM cron.job;

-- To remove later:
-- SELECT cron.unschedule('publish-scheduled-posts');
