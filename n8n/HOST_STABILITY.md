# Stabilize the DuckDNS n8n host

The signed-in editor at `https://aldreisantua-n8n.duckdns.org` previously showed
`503 Database is not ready!`, then loaded on retry. Its Help menu reported an update five
versions behind. These observations do **not** establish the root cause.

The actual host is the Google Compute Engine VM `n8n-server` in project
`n8n-projects-506408`, zone `us-west1-a`, with external IP `34.82.253.239`. The VM uses
Ubuntu 22.04, an `e2-micro` machine (1 GB RAM), and a 30 GB standard persistent disk.
Google Cloud reports automatic VM restart enabled and a daily boot disk snapshot schedule.
The VM's external IP is **ephemeral**. Google Cloud retains it for a VM reset but releases
it when the VM is stopped or suspended; DuckDNS then needs an update before the editor and
webhooks recover. See [Google's stop/reset behavior](https://docs.cloud.google.com/compute/docs/instances/suspend-stop-reset-instances-overview).
The local Windows PC's Docker contexts have no n8n container or image; changing Docker
Desktop on that PC will not change the live service.

The n8n editor's debug information reports version 2.35.7, Docker, SQLite, regular execution
mode, unlimited production concurrency (`-1`), filesystem binary storage, saving all
successful and failed executions, and pruning after 336 hours or 10,000 executions. The
Google Cloud Ops Agent chart for the last seven days showed sampled memory utilization
of approximately 37–73% and disk utilization up to 33%. Shorter spikes and container OOM
events require host logs to verify.

An SSH inspection on 2026-09-27 confirmed the VM had been up for 33 days. At that instant,
`free -h` showed 958 MiB RAM, 463 MiB available, and **725 MiB of 2 GiB swap in use**.
The boot filesystem was 32% full. `n8n-stack-n8n-1` and `n8n-stack-caddy-1` had each been
running for about four weeks. A single `docker stats --no-stream` sample showed n8n at
132.7 MiB and Caddy at 17.04 MiB; this does not capture peaks during workflow runs.
The Ubuntu login banner reported 87 available package updates, including 67 standard
security updates. Subsequent inspection found Docker enabled at boot, both containers set to
`restart: unless-stopped`, zero container restarts or OOM kills, and no kernel OOM event in the
last 30 days. At idle, `vmstat 1 5` showed no sustained swap-in/out and about 99% idle CPU.
These samples do not rule out pressure during workflow execution. The n8n container had no
memory limit. Caddy had 276 historical HTTP 502 responses in the last 30 days, concentrated
on August 30 and September 5; none appeared afterward. The logs did not establish their cause.

## Maintenance completed on 2026-09-27

The live stack is `/home/n8n-oci/n8n-stack` on the Google Cloud VM. Before editing it, a
root-only backup of that directory was saved at
`/var/backups/n8n/2026-09-27-stability/stack-before.tar.gz`. n8n was then stopped cleanly and
its persistent volume was saved at
`/var/backups/n8n/2026-09-27-stability/data-before.tar.gz`. Both archives passed `gzip -t`.
**These archives contain credentials and the encryption key; keep them restricted and never
copy them into this repository.** The database passed SQLite `PRAGMA quick_check` before and
after maintenance.

The SQLite database had 56,360 pages, of which 55,739 were free, despite pruning being
enabled and no stored executions remaining. An offline `VACUUM` reduced the file from about
221 MB to 2,486,272 bytes (607 pages, no free pages). This reclaims storage and may reduce
database file I/O; it does not prove that earlier editor failures were caused by SQLite.

The n8n service in the VM's Compose file now has
`EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` and `N8N_CONCURRENCY_PRODUCTION_LIMIT=2`.
Failed execution saving and the existing pruning settings were left in place. Successful
executions will no longer appear in execution history, which is the operational tradeoff for
lower database growth. The production concurrency limit queues additional production
executions; it does not constrain manual runs. Compose validation passed, the container was
recreated from its existing local image without pulling a new version, and Docker inspection
confirmed both settings on the running container.

After restart, a local request through Caddy returned HTTP 200 from `/healthz/readiness` in
1.57 seconds. A request from Cloud Shell outside the VM returned HTTP 200 in 0.73 seconds.
A request made *on the VM to its own public address* timed out; the local proxy and the
external Cloud Shell checks distinguish that path from public availability. The user-facing
editor and actual webhook executions were not smoke-tested as part of this host maintenance.

## Recurrence on 2026-09-28 (Manila time)

The editor again returned HTTP 503 `Database is not ready!`. The public readiness endpoint
subsequently returned HTTP 200. At 2026-09-27 19:52 UTC, Docker reported the n8n container
running since 12:30 UTC with zero restarts and `OOMKilled=false`; the VM had 363 MiB available
RAM, 568 MiB swap in use, and 68% free disk. These later samples do not establish resource use
during the outage.

Container logs for the incident window contained four `Database ping failed` messages with
`Database connection timed out`, two `Database connection recovered` messages, and two `Slow
database query` messages. Thus the immediate cause of the 503 was n8n marking its database
connection unavailable; the reason queries stalled remains unverified. The previous VACUUM and
execution-saving change reduced database growth but did not prevent this event.

`DB_SQLITE_POOL_SIZE` was unset on the running container, but a direct read-only check of the
SQLite file returned `journal_mode=wal` and `quick_check=ok`. Its database file was 3.5 MB and
its WAL file 4.1 MB. n8n's [database settings](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/database/)
say that a positive `DB_SQLITE_POOL_SIZE` gives it parallel read connections in WAL mode.

At 20:24 UTC, a root-only, stopped-volume backup was saved at
`/var/backups/n8n/2026-09-27T202427Z-before-wal/`; its archive passed `gzip -t`, and SQLite
passed `PRAGMA quick_check`. `DB_SQLITE_POOL_SIZE=1` was applied and the n8n container
recreated. The setting took effect and SQLite remained `wal`/`ok`, but readiness did not recover
during the startup check. The VM reached 86–94% disk I/O wait with n8n processes blocked in
uninterruptible disk sleep. The setting was then rolled back from the verified Compose backup,
and only n8n was recreated again. The data volume was **not** restored or replaced. The public
endpoint remained intermittently unready while disk wait continued. Do not repeat this pool
change as a presumed fix.

The immediate operational issue is severe boot-disk I/O latency on the 30 GB standard
persistent disk. This is supported by `vmstat` and blocked process state during the incident;
the precise source of the disk queue and a durable fix remain to be verified. Do not increase
the database ping timeout merely to hide these stalls.

The owner authorized a VM reboot after the rollback. The VM returned with the same IP and
Docker started both containers, but startup again had high disk I/O wait and intermittent
database ping timeouts. The Google Cloud Ops Agent used about 76 MiB RSS at that point; it
was stopped temporarily with `systemctl stop google-cloud-ops-agent` to reduce VM load.
Afterward, two public readiness checks returned HTTP 200 (2.47 seconds, then 0.49 seconds),
the last `vmstat` sample showed no I/O wait, and Docker reported n8n running with zero
restarts and `OOMKilled=false`. This sequence does **not** prove the Ops Agent caused the
stalls. Monitoring from that agent is currently stopped and will resume on its next start or
VM reboot unless its service configuration is changed. Continue measuring readiness and disk
latency during real workflow requests before claiming durable recovery.

After publishing WF-01 and WF-02 workflow edits, the production coach still returned
`agent_error` while the WF-01 editor test succeeded. Restarting only the n8n container caused
the published workflows to reactivate. Readiness returned to HTTP 200 and the previously
failing production follow-up returned HTTP 200. This restart did not establish why the
runtime and editor differed; repeated production requests and host monitoring remain necessary.

## Inspect the host first

On the **Google Cloud Ubuntu VM**, record the following without copying passwords,
environment variables, credential exports, or complete logs into this repository:

```sh
uname -a
free -h
df -h
uptime
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker stats --no-stream
journalctl -k --since '7 days ago' --no-pager | grep -Ei 'out of memory|oom|killed process' || true
```

On this VM the SSH user is not in the Docker group, so prefix Docker commands with `sudo -n`.
The VM already has 2 GiB of swap; adding more swap before measuring swap-in and swap-out
would risk hiding memory pressure and worsening latency. Use `vmstat 1 5` during a slow
period, then inspect container restart and OOM history before changing limits.

For the n8n container identified above, inspect its restart count, restart
policy, memory limit, and exit reason. Do not print their environment variables:

```sh
docker inspect <n8n-container> --format '{{json .State}} {{json .HostConfig.RestartPolicy}} {{.HostConfig.Memory}}'
```

Check n8n and system logs around a failed request locally. Redact tokens and personal data
before sharing excerpts. Confirm where the SQLite database and encryption key are mounted
on persistent storage, and whether Docker starts automatically when the VM reboots.

Probe `https://aldreisantua-n8n.duckdns.org/healthz/readiness` during an outage, not just
`/healthz`. n8n says `/healthz` only proves reachability; readiness requires a connected,
migrated database. See [n8n monitoring](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/monitor-n8n).

## Apply fixes in order

1. **Back up before changing the runtime.** A full backup needs the `.n8n` user folder and,
   when PostgreSQL is used, a consistent PostgreSQL backup. Keep the existing encryption key:
   credentials cannot be restored without it. See [n8n backup and restore](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/backup-and-restore).
2. **Fix the demonstrated failure.** If readiness fails while `/healthz` succeeds, inspect
   the SQLite file and filesystem mount, n8n container state, and startup logs. If both
   fail, inspect the VM, n8n container, reverse proxy, and network. A Docker restart policy
   helps after a container crash but cannot fix a stalled database or exhausted VM.
3. **Measure resource pressure.** If n8n or the database is being killed for memory, reduce
   workflow payload sizes and simultaneous production executions before changing the runtime.
   Large PDFs and manual workflow runs use extra memory. Avoid raising Node's heap limit
   beyond available physical RAM. See [memory guidance](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/fix-memory-issues)
   and [concurrency control](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/control-concurrency).
4. **Reduce database growth.** Successful execution saving is now disabled and pruning was
   already enabled. Keep an eye on database size and execution history needs before changing
   retention further. SQLite can reuse pruned pages, but an offline `VACUUM` is needed to
   return that space to the filesystem. See [execution data](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/manage-execution-data).
5. **Upgrade carefully.** The editor reports five versions behind. Review release notes,
   back up, test an upgrade, then update n8n and any workers together. Do not use `latest`
   blindly on the production database. The VM also reports 67 standard security updates;
   schedule those after a verified backup and recovery plan, with a post-reboot readiness check.
   See [n8n update guidance](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/update-n8n).
6. **Protect the DuckDNS route.** Check that DuckDNS still resolves to the VM's current
   external IP after every VM stop/start. For reliable recovery, either arrange a DuckDNS
   update on VM boot or reserve a static external IP after checking its monthly cost.

## If Docker must be removed

A Dockerless setup on a Linux host can run a pinned n8n version under `systemd` with
`Restart=on-failure`, a persistent `.n8n` user folder, PostgreSQL, and a TLS reverse proxy.
That is a migration, not a performance toggle: restore the database **and** encryption key,
verify credentials and webhooks, then change DNS or application URLs. Keep the current instance
available for rollback until the new one passes live smoke tests.

On the existing Google Cloud `e2-micro`, replacing Docker with a bare npm process might save
some overhead, but the host still has only 1 GB RAM and the same SQLite database. The
container runtime is not yet shown to be the source of outages. n8n's
[npm installation docs](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-npm)
state that npm installs are deprecated from n8n 3.0. Do not make npm the long-term production
plan without accepting that maintenance constraint.

## Change gate

Do not switch Vercel webhooks to this host until the four V-Unite webhooks are imported,
activated, and verified with synthetic data. See [cutover steps](SELF_HOSTED_CUTOVER.md).
