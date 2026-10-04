# Backend maintenance scripts

Run these by hand from `backend/` with the app's MongoDB settings (`MONGODB_URL` or `MONGODB_URI`) in the environment.

## normalize_student_ids.py

Reports and normalizes `alumni_profiles.student_id` values (trimmed and uppercased, the same form the app saves and checks).

```bash
python -m scripts.normalize_student_ids          # dry run: prints a summary, writes nothing
python -m scripts.normalize_student_ids --apply  # writes normalized values
```

- **Get Mark's OK before running `--apply` against any real database.**
- Duplicates are detected on normalized values, in dry run too.
- `--apply` only rewrites values that don't collide. Any group that would share a student ID after normalization is skipped and listed (student ID and profile ids only) for manual resolution.
- It never deletes or merges profiles.
- The app creates the unique index `uq_alumni_profiles_student_id` at startup only when there are no normalized duplicates; otherwise it logs the conflicts and keeps running. Resolve those, then restart the app.
