# MySQL initialization scripts

Put the database schema or seed files with a `.sql` extension in this directory.
MySQL runs them automatically when the database volume is created for the first time.

For example:

```text
database/init/001-schema.sql
database/init/002-seed.sql
```

If `mysql-data` already exists, remove that volume before restarting when you need
the initialization scripts to run again:

```powershell
docker compose down -v
docker compose up --build
```