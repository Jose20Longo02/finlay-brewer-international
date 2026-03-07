const { S3Client, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

function isSpacesEnabled() {
  return !!(
    process.env.SPACES_KEY &&
    process.env.SPACES_SECRET &&
    process.env.SPACES_BUCKET &&
    process.env.SPACES_ENDPOINT
  );
}

function getEndpointHost() {
  const raw = process.env.SPACES_ENDPOINT || '';
  return raw.replace(/^https?:\/\//i, '');
}

function getSpacesClient() {
  if (!isSpacesEnabled()) return null;
  return new S3Client({
    region: process.env.SPACES_REGION || 'us-east-1',
    endpoint: `https://${getEndpointHost()}`,
    credentials: {
      accessKeyId: process.env.SPACES_KEY,
      secretAccessKey: process.env.SPACES_SECRET
    }
  });
}

function getPublicBaseUrl() {
  if (process.env.SPACES_CDN_URL) return process.env.SPACES_CDN_URL.replace(/\/+$/, '');
  if (process.env.SPACES_ORIGIN_URL) return process.env.SPACES_ORIGIN_URL.replace(/\/+$/, '');
  const endpointHost = getEndpointHost();
  return `https://${process.env.SPACES_BUCKET}.${endpointHost}`;
}

function buildSpacesUrl(key) {
  const safeKey = String(key || '').replace(/^\/+/, '');
  return `${getPublicBaseUrl()}/${safeKey}`;
}

async function moveObject(oldKey, newKey) {
  if (!isSpacesEnabled()) return null;
  const client = getSpacesClient();
  const bucket = process.env.SPACES_BUCKET;
  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${oldKey}`,
    Key: newKey,
    ACL: 'public-read'
  }));
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: oldKey
  }));
  return buildSpacesUrl(newKey);
}

module.exports = {
  isSpacesEnabled,
  getSpacesClient,
  buildSpacesUrl,
  moveObject
};
