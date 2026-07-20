# Deployment — single VPS

The school runs on one VPS with a real filesystem and PostgreSQL. That decision shapes
everything below: file storage is local disk (the S3 driver is an unimplemented stub), and
scheduled work runs from system cron rather than inside the app process.

---

## 1. Prerequisites

- Node 22+ and npm (the repo uses **npm** — `package-lock.json`)
- PostgreSQL 15+
- A reverse proxy terminating TLS (nginx/Caddy) in front of port 3000

## 2. First install

```bash
git clone <repo> /srv/planete-montessori && cd /srv/planete-montessori
npm ci
npm approve-scripts prisma @prisma/engines esbuild   # npm 11 gates install scripts
cp .env.example .env && $EDITOR .env                 # see section 3
npx prisma migrate deploy                            # NEVER `migrate reset` on a live DB
npm run build
```

Create the first director account by running the seed **once on an empty database**
(`npm run db:seed`) and then changing that password — the seed truncates every table, so it must
never be run against a database with real school data in it.

## 3. Environment

Every variable is documented in `.env.example`. Two are easy to get wrong and cause silent data
loss rather than an error:

**`STORAGE_LOCAL_DIR` must be an absolute path outside the deploy directory.**

```bash
STORAGE_LOCAL_DIR="/var/lib/planete-montessori/storage"
```

The default `./storage` sits *inside* the app. A deploy that replaces the directory — a fresh
`git clone`, or `rsync --delete` — destroys every uploaded justificatif, homework submission and
student photo. Nothing warns you; the database still holds `StoredFile` rows pointing at files
that no longer exist.

**`AUTH_URL` (and `APP_URL`, if the public URL differs) must be the real https origin**, or the
links inside notification e-mails point at localhost.

## 4. Backups — two things, not one

```bash
# nightly
pg_dump "$DATABASE_URL" | gzip > /backups/db-$(date +%F).sql.gz
tar czf /backups/uploads-$(date +%F).tar.gz -C /var/lib/planete-montessori storage
```

A `StoredFile` row and the bytes on disk are two halves of one record. Backing up only the
database leaves rows pointing at missing files; backing up only the directory leaves bytes nobody
can find. **Test a restore** before you need one.

## 5. Scheduled jobs

`--conditions=react-server` is **required** — the data layer imports `server-only`, which throws
without it, and the job dies before it starts.

```cron
0 7 * * * cd /srv/planete-montessori && /usr/bin/npx tsx --conditions=react-server \
  scripts/jobs.ts daily >> /var/log/planete-montessori-jobs.log 2>&1
```

Jobs: `overdue` (flip past-due unpaid installments), `payment-reminders`, `absence-alerts`.
`daily` runs all three. Everything is idempotent — running it twice chases a parent once — so a
retry after a failure is safe. The process exits non-zero if any job reported an error, so cron's
own mail surfaces problems instead of them passing unnoticed.

Test without sending anything: `... scripts/jobs.ts daily --dry-run`.

## 6. E-mail

Set `SMTP_*` and notifications go out in **each recipient's own language** (`User.locale`), Arabic
in an RTL document. Leave `SMTP_HOST` empty and e-mail is disabled: rows are still written and
left `PENDING`, never falsely marked sent. A refused delivery is recorded `FAILED` with the SMTP
reason — check `/director/audit` and the Notification table if a parent says they got nothing.

SMS and WhatsApp remain deliberate stubs; they need a provider account and are not wired.

## 7. Running

Use a process manager so the app restarts on boot and on crash — systemd unit or pm2:

```ini
# /etc/systemd/system/planete-montessori.service
[Service]
WorkingDirectory=/srv/planete-montessori
ExecStart=/usr/bin/npm run start
Restart=always
EnvironmentFile=/srv/planete-montessori/.env
```

## 8. Updating

```bash
cd /srv/planete-montessori && git pull
npm ci
npx prisma migrate deploy      # additive migrations only; review the SQL first
npm run build
systemctl restart planete-montessori
```

Check `npx prisma migrate status` after deploying. It compares *migrations to the database* — it
does **not** notice when `schema.prisma` has models that were never migrated, which has bitten this
project before (the whole e-learning feature typechecked with none of its tables existing).

## 9. Health check after a deploy

```bash
curl -sf https://your-domain/fr/login  > /dev/null && echo "app up"
npx tsx --conditions=react-server scripts/jobs.ts overdue   # exercises DB write access
```

Log in as each of the five roles once. RBAC is enforced server-side per route and per action, so a
misconfigured proxy cannot expose data — but a broken `AUTH_URL` will break login for everyone.
