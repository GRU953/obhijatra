-- WHAT THIS DOES
--   Reads what is actually in the system. Read-only: it changes nothing.
--   Useful for answering "did that really arrive?" without guessing.
\echo '--- organisations ---'
select o.name, count(distinct p.id) as people
  from organisations o left join profiles p on p.organisation_id = o.id
 group by o.name order by o.name;

\echo '--- submissions that reached the server ---'
select s.form_id,
       s.form_version,
       s.device_id,
       s.answers,
       to_char(s.collected_at, 'YYYY-MM-DD HH24:MI') as collected,
       to_char(s.received_at,  'YYYY-MM-DD HH24:MI') as arrived,
       -- If these differ by minutes, the answer was collected offline and
       -- arrived later. That is the whole point of the app, so it is shown.
       round(extract(epoch from (s.received_at - s.collected_at))/60.0, 1) as minutes_offline
  from submissions s
 order by s.server_seq desc
 limit 20;

\echo '--- totals ---'
select count(*) as total_submissions,
       count(*) filter (where received_at - collected_at > interval '30 seconds') as arrived_after_a_delay
  from submissions;
