const path = require("path");
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    const error = new Error("Azure Blob Storage no esta configurado. Define AZURE_STORAGE_CONNECTION_STRING.");
    error.status = 503;
    error.code = "AZURE_STORAGE_NOT_CONFIGURED";
    throw error;
  }

  return connectionString;
}

function sanitizeFileName(fileName = "archivo") {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path
    .basename(fileName, extension)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "archivo";

  return `${baseName}${extension}`;
}

function buildPublicUrl(publicBaseUrl, containerName, blobName, fallbackUrl) {
  if (!publicBaseUrl) return fallbackUrl;

  const base = publicBaseUrl.replace(/\/+$/, "");
  const encodedBlobName = blobName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${base}/${containerName}/${encodedBlobName}`;
}

async function getContainerClient(containerName, privateAccess = false) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  const containerClient = blobServiceClient.getContainerClient(containerName);

  await containerClient.createIfNotExists();
  if (privateAccess) await containerClient.setAccessPolicy();
  return containerClient;
}

async function getPrivateContainerClient() {
  const containerName = process.env.AZURE_BLOB_CONTAINER || "serialcare";
  return getContainerClient(containerName, true);
}

function getEvidenceContainerName() {
  return process.env.AZURE_STORAGE_CONTAINER || "evidencias";
}

function getEvidenceBlobName(reference) {
  const value = String(reference || "").trim();

  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return value.startsWith("orden-") ? value : null;
  }

  try {
    const parsedUrl = new URL(value);
    const configuredOrigins = new Set();
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const publicBaseUrl = process.env.AZURE_STORAGE_PUBLIC_BASE_URL;

    if (connectionString) {
      configuredOrigins.add(new URL(BlobServiceClient.fromConnectionString(connectionString).url).origin);
    }

    if (publicBaseUrl) {
      configuredOrigins.add(new URL(publicBaseUrl).origin);
    }

    if (!configuredOrigins.has(parsedUrl.origin)) return null;

    const marker = `/${getEvidenceContainerName()}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex < 0) return null;

    return parsedUrl.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return null;
  }
}

async function uploadPrivateBuffer(blobName, buffer, contentType, metadata = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("El contenido para Azure Blob Storage esta vacio");
    error.status = 400;
    throw error;
  }

  const containerClient = await getPrivateContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" },
    metadata
  });

  return { blobName, url: blockBlobClient.url, size: buffer.length };
}

async function downloadPrivateBuffer(blobName) {
  const containerClient = await getPrivateContainerClient();
  return containerClient.getBlockBlobClient(blobName).downloadToBuffer();
}

async function deletePrivateBlob(blobName) {
  const containerClient = await getPrivateContainerClient();
  return containerClient.deleteBlob(blobName, { deleteSnapshots: "include" });
}

async function uploadEvidenceFile(file, ordenId) {
  if (!file?.buffer) {
    const error = new Error("Archivo de evidencia no recibido");
    error.status = 400;
    throw error;
  }

  const containerName = getEvidenceContainerName();
  const publicBaseUrl = process.env.AZURE_STORAGE_PUBLIC_BASE_URL;
  const containerClient = await getContainerClient(containerName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeFileName = sanitizeFileName(file.originalname);
  const blobName = `orden-${ordenId}/${timestamp}-${safeFileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype || "application/octet-stream"
    },
    metadata: {
      ordenId: String(ordenId),
      originalName: safeFileName
    }
  });

  return {
    nombre_archivo: safeFileName,
    url_archivo: buildPublicUrl(publicBaseUrl, containerName, blobName, blockBlobClient.url),
    tipo: file.mimetype,
    mimetype: file.mimetype,
    size: file.size,
    blob_name: blobName
  };
}

async function downloadEvidenceFile(blobName) {
  const containerClient = await getContainerClient(getEvidenceContainerName());
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const [buffer, properties] = await Promise.all([
    blockBlobClient.downloadToBuffer(),
    blockBlobClient.getProperties()
  ]);

  return {
    buffer,
    contentType: properties.contentType || "application/octet-stream"
  };
}

module.exports = {
  uploadEvidenceFile,
  downloadEvidenceFile,
  getEvidenceBlobName,
  uploadPrivateBuffer,
  downloadPrivateBuffer,
  deletePrivateBlob,
  getContainerClient
};