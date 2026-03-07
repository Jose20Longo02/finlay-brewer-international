const { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

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
  const region = process.env.SPACES_REGION || (getEndpointHost().split('.')[0] || '');
  if (region) {
    return `https://${process.env.SPACES_BUCKET}.${region}.cdn.digitaloceanspaces.com`;
  }
  const endpointHost = getEndpointHost();
  return `https://${process.env.SPACES_BUCKET}.${endpointHost}`;
}

function buildSpacesUrl(key) {
  const safeKey = String(key || '').replace(/^\/+/, '');
  return `${getPublicBaseUrl()}/${safeKey}`;
}

function normalizeSpacesUrl(url) {
  if (!url || typeof url !== 'string' || !isSpacesEnabled()) return url;
  const endpointHost = getEndpointHost();
  const bucket = process.env.SPACES_BUCKET;
  const region = process.env.SPACES_REGION || (endpointHost.split('.')[0] || '');
  const originHost = `${bucket}.${endpointHost}`;
  const cdnHost = region ? `${bucket}.${region}.cdn.digitaloceanspaces.com` : originHost;
  try {
    const u = new URL(url);
    if (u.hostname === originHost || u.hostname.endsWith('.digitaloceanspaces.com')) {
      u.hostname = cdnHost;
      u.protocol = 'https:';
      return u.toString();
    }
  } catch (_) {
    return url;
  }
  return url;
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

async function deletePropertyFolder(propertyId) {
  if (!isSpacesEnabled() || !propertyId) return;
  const client = getSpacesClient();
  const bucket = process.env.SPACES_BUCKET;
  const prefix = `Properties/${propertyId}/`;
  let continuationToken;
  do {
    const listRes = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    const keys = (listRes.Contents || []).map((o) => o.Key).filter(Boolean);
    if (keys.length > 0) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }
      }));
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);
}

module.exports = {
  isSpacesEnabled,
  getSpacesClient,
  buildSpacesUrl,
  moveObject,
  normalizeSpacesUrl,
  deletePropertyFolder
};
