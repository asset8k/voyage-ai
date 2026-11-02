# Portfolio availability monitoring

Voyage AI runs a FastAPI backend on FastAPI Cloud, PostgreSQL on Supabase,
and a React/Vite frontend on Vercel. An external cron-job.org request can check
both the API and its database and may reduce cold starts and inactivity pauses.
It does not guarantee an always-running free instance.

## Implementation and diagnosis

- `GET /api/health` remains a public, database-independent liveness check used by hosting.
- `GET /internal/keepalive` is a separate, authenticated readiness check. It runs
  `SELECT 1 /* voyage_keepalive */` through the same SQLAlchemy engine and
  `DATABASE_URL` used by the application. It performs no writes, table scans,
  migrations, AI requests, or third-party API calls.
- The readiness check has a five-second application timeout covering connection
  checkout, connection establishment, the query, and connection release. Platform
  cold-start time happens before this application timeout begins.
- It returns `200 {"status":"ok","database":"ok"}` only after SQL succeeds.
  Database errors, connection failures, and timeouts return a generic `503`.
  Missing, incorrect, or unconfigured tokens return `403` before querying.
- The `X-Keepalive-Token` header is compared using `secrets.compare_digest`.
  Responses use `Cache-Control: no-store`; the route is omitted from public OpenAPI.
  Logs record outcome, latency, and exception type, without exception details,
  tokens, or database credentials.
- SQLAlchemy checks pooled connections before reuse, limits pool checkout to ten
  seconds, and configures asyncpg connection and command timeouts of ten and
  thirty seconds respectively. Existing sessions and business queries are reused.

The FastAPI lifespan performs no database migrations, model loading, remote
requests, or database connection at startup; it only disposes the engine at
shutdown. Importing the routers loads the OpenAI SDK and constructs an HTTP
client, but does not call an AI service. Lazy database connection establishment
means a database-backed request also pays connection and TLS setup on first use.
Likely latency sources are platform replica startup, Python imports on a small
instance, initial database connection, and stale pooled connections. These are
diagnostic inferences, not measured attribution from production tracing.

The frontend previously awaited requests indefinitely. Reads now have a
20-second timeout per attempt and up to three attempts, with one- and two-second
backoff (about 63 seconds maximum, excluding browser scheduling delays). Only
network failures, timeouts, and HTTP 502/503/504 are retried. Authentication,
validation, not-found, rate-limit, and other failures are not retried. Writes
have a 60-second timeout; generation and refinement have 180 seconds. Writes
are never automatically replayed. Existing loading screens, disabled submit
buttons, error messages, and retry controls remain in use.

Aborting a browser request cannot cancel work already running on the server.
After a write timeout, check the saved trips before resubmitting. Generation
and refinement may still complete and incur their normal AI cost.

## Environment variables and deployment

`DATABASE_URL` continues to point to the actual Supabase PostgreSQL database;
no additional Supabase API key or database object is required.

Add one optional backend environment variable:

```dotenv
KEEPALIVE_TOKEN=<dedicated-random-monitoring-token>
```

Generate it locally with `openssl rand -hex 32`. Copy the same value into the
backend configuration and scheduler header. Use a separate token for each
project. Leave it empty to disable authenticated monitoring. Existing app
configuration remains valid when this variable is absent.

Do not reuse JWT secrets, database passwords, service-role keys, Google keys,
or AI API keys. Never put this value in a URL, frontend `VITE_*` variable,
committed file, screenshot, or public status page. The dedicated token grants
only permission to run this fixed read-only check. cron-job.org's terms caution
against transmitting security-critical secrets; it must not receive credentials
that grant application or database access.

Deployment is a manual step:

1. Review and merge these changes, then deploy the backend through the project's
   existing FastAPI Cloud workflow. No migration is needed.
2. Add `KEEPALIVE_TOKEN` to that app's environment settings and apply/redeploy.
3. Deploy the frontend changes through Vercel.
4. Restore the Supabase project manually first if it is already paused. This
   endpoint reports a paused database as unavailable; it cannot resume it.
5. Verify the endpoint before creating the scheduled job.

## One cron-job.org account, three independent jobs

One free account can contain separate jobs for Voyage AI, Pole Position, and
Roometry. Each app needs its own deployed endpoint, token, and job; one job
does not automatically check the other applications. This repository changes
only Voyage AI. Implement and verify the equivalent endpoint in the other
repositories before adding their jobs.

Create the Voyage AI job in the cron-job.org console with these settings:

| Setting | Value |
| --- | --- |
| Title | Voyage AI readiness |
| URL | `https://voyage-ai.fastapicloud.dev/internal/keepalive` |
| Method | `GET` |
| Header name | `X-Keepalive-Token` |
| Header value | The dedicated backend `KEEPALIVE_TOKEN` value |
| Body | None |
| Schedule | Every five minutes, every day (`*/5 * * * *`) |
| Time zone | UTC (the interval is independent of local time) |
| Request timeout | 30 seconds |
| Expected result | HTTP 200, JSON `status=ok` and `database=ok` |
| Notifications | Failure, recovery, and automatic job deactivation |
| Redirects | Use the final HTTPS URL above; redirects are not a success |

The HTTP status is the scheduler's success signal; the JSON body is for manual
verification. A static Vercel URL, cached response, or `/api/health` is not a
substitute because those do not verify database activity.

Run the console's test execution and inspect the response. If successful,
enable the schedule. Repeat with each other app's own backend URL and token
after implementing its endpoint. Stagger their schedules if convenient.
At five-minute intervals this is 288 requests per app per day (864 total for
three), with a single lightweight SQL query per successful request, plus pool
validation when an existing connection is reused.

## Local and deployed verification

Set the normal backend variables in `.env` and a dedicated test token, then
start the server:

```sh
uv run fastapi dev src/voyage_ai/main.py
```

Export that same token in your shell, then test without including it in URLs:

```sh
curl --fail-with-body --max-time 30 \
  -H "X-Keepalive-Token: $KEEPALIVE_TOKEN" \
  http://127.0.0.1:8000/internal/keepalive
```

Expected: HTTP 200 and `{"status":"ok","database":"ok"}`. Repeat without the
header and with an incorrect header: both must return 403. With a local test
database stopped or inaccessible, the correct token must produce 503. Do not
stop or reconfigure the production database to test a failure.

After deployment, repeat the command with
`https://voyage-ai.fastapicloud.dev/internal/keepalive` and `--write-out`:

```sh
curl --fail-with-body --max-time 30 \
  -H "X-Keepalive-Token: $KEEPALIVE_TOKEN" \
  -w '\nHTTP %{http_code}; first byte %{time_starttransfer}s; total %{time_total}s\n' \
  https://voyage-ai.fastapicloud.dev/internal/keepalive
```

To verify actual Supabase activity, use the application's success logs together
with Supabase database query/usage metrics. If `pg_stat_statements` is already
enabled and available to your admin role, this optional read-only query can
confirm repeated executions without reading business data:

```sql
SELECT query, calls
FROM pg_stat_statements
WHERE query LIKE '%voyage_keepalive%'
  AND query NOT LIKE '%pg_stat_statements%';
```

PostgreSQL can group normalized statements and retain a representative query
without this comment. Absence of a matching row alone does not prove failure.
Do not enable extensions, expose tables, or change RLS just for monitoring.
SQLAlchemy execution is covered by a real PostgreSQL integration test.

To evaluate cold starts, record first-byte/total times for the first request
after a known idle period and a second immediate request. Check FastAPI Cloud's
replica metrics to confirm whether it had scaled to zero. Then enable the
five-minute job and observe at least 24 hours of execution history and replica
metrics, and at least a week of Supabase activity and pause-warning emails.
Do not label a slow response a confirmed cold start without replica evidence.

The published FastAPI Cloud docs do not state a fixed idle threshold or promise
that monitoring requests prevent scaling down. If repeated measurements show
five minutes is insufficient, check current account limits and provider policy
before trying a two-minute interval (cron-job.org supports down to one minute).
Increasing frequency may consume more compute without preventing cold starts.

## Failures and free-tier constraints

- **403:** token missing, wrong, or not applied to the deployed backend.
- **503:** database connection/query timed out or failed. Check backend logs
  and Supabase status, including whether manual resume is needed.
- **404:** endpoint not deployed or incorrect path/backend host.
- **Scheduler timeout:** platform startup or network time may exceed the free
  scheduler's 30-second limit before application code runs. Inspect the next
  execution and backend logs instead of repeatedly retrying by hand.
- Enable failure and recovery email notifications. cron-job.org may disable a
  job after more than 25 consecutive failures; enable deactivation alerts too.
- Supabase says a few database requests per day are typically enough, but
  free-plan pause prevention is not guaranteed and its exact threshold can change.
- Hobby minimum replicas remain zero. Monitoring does not buy always-on service
  or an SLA, and does not prevent platform restarts or deployments.
- FastAPI Cloud currently describes beta compute usage as not invoiced, but
  publishes **planned 180 Nano replica-hours per billing period shared across
  Hobby team apps**. Three continuously running replicas would consume about
  **2,160 hours in a 30-day month**. Before usage billing starts or plan rules
  change, review the account's actual limits. Continuous warmth for three apps
  cannot be promised within that planned allowance. A limited daily demo window
  or a few checks per day can reduce usage and maintain database activity, but
  deliberately allows cold starts outside the window.
- cron-job.org allows multiple free jobs and requires fair use. Its service has
  no availability guarantee. Check provider policies before shortening intervals.
- All normal frontend, database, and external API quotas continue to apply. This
  check makes no paid AI or Places requests, but uses backend compute and network.

Provider references checked on November 2, 2026:

- [FastAPI Cloud autoscaling](https://fastapicloud.com/docs/advanced-features/autoscaling/)
- [FastAPI Cloud planned usage and pricing](https://fastapicloud.com/docs/team-management/billing/usage-based-billing/)
- [FastAPI Cloud terms](https://fastapicloud.com/legal/terms/)
- [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [cron-job.org FAQ and limits](https://cron-job.org/en/faq/)
- [cron-job.org terms](https://cron-job.org/en/tos/)

## Disable or remove

Disable/delete the external job first, then unset or empty `KEEPALIVE_TOKEN` and
redeploy the backend. The route will reject all requests with 403. To remove
the feature entirely, remove the internal router registration/module and token
setting. No database objects or business records need cleanup. Frontend timeout
handling and pool validation can remain useful without scheduled monitoring.

## Verification boundary

Before these changes were deployed, read-only production checks on November 2,
2026 returned HTTP 200: first health request 7.58 seconds, immediate second
health request 0.70 seconds, and the database-backed public feed 4.33 seconds.
This is consistent with warm-up latency, but the idle duration and replica
state were not available, so it is not proof of a measured platform cold start.

Implementation is tested locally with an isolated PostgreSQL database and
mocked network failures. It has not been deployed or connected to a live
scheduled job as part of this change. No production configuration, credentials,
other project repositories, or database schemas were modified. Cold-start
elimination and long-term pause prevention remain unverified until the
post-deployment observation above is completed.
