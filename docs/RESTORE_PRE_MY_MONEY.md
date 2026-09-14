# Restore point before My Money

- Git checkpoint: `e5965b6` (includes all source changes and the approved previews).
- Tag: `restore/pre-my-money-2026-09-13`.
- Implementation branch: `feat/my-money-integration`.
- Local database backup: `database/backups/pre-my-money-2026-09-13.dump` (intentionally ignored by Git).
- Backup SHA-256: `0E646E2B698F6C9195253CF5D0CDC7297F9B66241F0C514434D5A95D8FBC55BB`.
- Backup verified with PostgreSQL 16 `pg_restore --list` before any schema changes.

To inspect the exact previous source without changing this working tree:

```powershell
git worktree add ../SpliteEasy-before-my-money restore/pre-my-money-2026-09-13
```

For a full rollback, preserve any newer work first and switch to a branch made from the tag. Restore the database dump into a **new database** and point the restored application at it. Do not use `down -v` or overwrite the active database: the snapshot predates any subsequent financial records. Local `.env` files are excluded from Git and remain in the current workspace.
