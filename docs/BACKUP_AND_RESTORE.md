# Backup and restore

The database (all records) and the Storage buckets (uploaded documents and images) must both be backed up.

## Automated backups

- **Supabase Pro plan and above:** daily backups are automatic. Enable **Point-in-Time Recovery** (Dashboard → Database → Backups) for restores to any second within the retention window. Recommended for production because the system holds financial records.
- **Free plan:** there are no automatic backups you can restore yourself. Use the scheduled logical backup below.

## Scheduled logical backup (any plan)

Run nightly from a trusted machine or CI runner that has the database connection string (Dashboard → Connect → Session pooler):

```bash
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=storage --file "college-$(date +%F).dump"
```

Copy the file to off-site storage that is encrypted and access-controlled, and keep at least 30 daily and 12 monthly copies.

Storage objects (documents/images) are not included in `pg_dump`. Mirror them with the Supabase CLI or any S3-compatible tool against the project's S3 endpoint (Dashboard → Storage → S3 Connection):

```bash
aws s3 sync s3://documents ./backup/documents --endpoint-url "$SUPABASE_S3_ENDPOINT"
```
```bash
aws s3 sync s3://public-media ./backup/public-media --endpoint-url "$SUPABASE_S3_ENDPOINT"
```

Record what you have set up in **Admin → Settings → Backups**, so administrators can see the current arrangement.

## Restore procedure

1. **Decide the scope.** A whole-project point-in-time restore uses Dashboard → Database → Backups → Restore. Note that it rewinds *all* data.
2. **Logical restore into a new project** (safest; verify before switching):
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists -d "$NEW_DB_URL" college-YYYY-MM-DD.dump
   ```
   Then re-upload the storage buckets with `aws s3 sync ./backup/documents s3://documents …`.
3. Point a Vercel *Preview* deployment at the restored project and verify:
   - sign-in
   - one student ledger total against the last known report
   - the most recent office file
   - a document download
4. Switch the production environment variables to the restored project, or copy the verified data back, and redeploy.
5. Record the incident and the restore time in the settings backup notes.

## Test the procedure

Restore the latest dump into a scratch project at least once a term and complete step 3.
