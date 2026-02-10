### R2 File Manager

Simple Cloudflare R2 file manager — upload, list, view (signed URLs), and delete files via a minimal web UI and small Express API.

- **Keywords**: Cloudflare R2, S3-compatible, file manager, signed URLs, upload, delete, list

## Overview

R2 File Manager is a tiny Node.js app that provides a web UI (served from `public/`) and an API to manage files in a Cloudflare R2 bucket. It's useful for quick uploads, previews (via presigned URLs), and bulk deletes.

## Features

- Upload files to R2
- List objects with pagination
- Generate short-lived signed URLs for viewing
- Delete single or multiple objects
- Lightweight single-file server (`server.js`)

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` with the required environment variables (see below).

3. Run:

```bash
npm start
# or for development
npm run dev
```

The app serves the UI from `public/index.html` and the API on the same host (default port `3000` or set `PORT`).

## Environment variables

Set the following values in your environment or in a `.env` file:

- `R2_ENDPOINT` — your R2 endpoint (e.g. `https://<account_id>.r2.cloudflarestorage.com`)
- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 access key id
- `R2_SECRET_ACCESS_KEY` — R2 secret access key
- `R2_BUCKET` — target bucket name
- `PORT` — optional server port (default `3000`)

## API endpoints

- `POST /upload` — form upload (`multipart/form-data`, field name `file`). Returns `{ ok: true, key }` on success.
- `GET /list?pageSize=<n>&continuationToken=<token>` — lists objects with pagination. Returns `{ ok: true, items, nextContinuationToken, isTruncated }`.
- `POST /delete` — JSON body `{ keys: ["key1", "key2"] }` to delete objects.
- `GET /signed/:key` — returns a presigned GET URL for `:key` (short-lived).

Example curl upload:

```bash
curl -F "file=@/path/to/file.jpg" http://localhost:3000/upload
```

Example list:

```bash
curl "http://localhost:3000/list?pageSize=24"
```

## Notes

- The server uses the AWS SDK v3 (`@aws-sdk/client-s3`) pointed at a custom `endpoint` for R2.
- Static UI is in `public/` and uses the `/signed/:key` endpoint to show previews.

## License

MIT


