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

  const containerName = process.env.AZURE_STORAGE_CONTAINER || "evidencias";
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

module.exports = {
  uploadEvidenceFile,
  uploadPrivateBuffer,
  downloadPrivateBuffer,
  deletePrivateBlob,
  getContainerClient
};