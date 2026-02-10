require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const stream = require('stream');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const { R2_ENDPOINT, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;

if (!R2_ENDPOINT || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2 configuration in environment variables.');
  process.exit(1);
}

const s3client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const key = file.originalname;
    await s3client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    res.json({ ok: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/list', async (req, res) => {
  try {
    const pageSize = Math.min(1000, parseInt(req.query.pageSize, 10) || 50);
    const continuationToken = req.query.continuationToken || undefined;

    const params = { Bucket: R2_BUCKET, MaxKeys: pageSize };
    if (continuationToken) params.ContinuationToken = continuationToken;

    const resp = await s3client.send(new ListObjectsV2Command(params));
    const items = (resp.Contents || []).map(i => ({ key: i.Key, size: i.Size, lastModified: i.LastModified }));
    res.json({ ok: true, items, nextContinuationToken: resp.NextContinuationToken || null, isTruncated: !!resp.IsTruncated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/delete', async (req, res) => {
  try {
    const { keys } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) return res.status(400).json({ error: 'keys must be a non-empty array' });

    const Objects = keys.map(Key => ({ Key }));
    const resp = await s3client.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects } }));
    res.json({ ok: true, resp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/signed/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const url = await getSignedUrl(s3client, command, { expiresIn: 60 * 60 });
    res.json({ ok: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// Stream object through the server so downloads work reliably (and avoid CORS issues)
app.get('/download/*', async (req, res) => {
  try {
    const key = req.params[0];
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const resp = await s3client.send(command);

    const contentType = resp.ContentType || 'application/octet-stream';
    const contentLength = resp.ContentLength;
    const filename = path.basename(key);

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    // Use Content-Disposition attachment so browsers download instead of navigating
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // resp.Body is a stream; pipe it to the response
    const bodyStream = resp.Body;
    if (bodyStream && typeof bodyStream.pipe === 'function') {
      bodyStream.pipe(res);
      bodyStream.on('error', (e) => {
        console.error('Stream error:', e);
        try { res.destroy(e); } catch (err) {}
      });
    } else {
      // Fallback: collect and send
      const chunks = [];
      for await (const chunk of resp.Body) chunks.push(chunk);
      res.end(Buffer.concat(chunks));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.use(express.static('public'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on port', port));


