const path = require("path");
const { BlobServiceClient } = require("@azure/storage-blob");

function getAzureConfig() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER || "evidencias";
  const publicBaseUrl = process.env.AZURE_STORAGE_PUBLIC_BASE_URL;

  if (!connectionString) {
    const error = new Error("Azure Blob Storage no esta configurado. Define AZURE_STORAGE_CONNECTION_STRING.");
    error.status = 500;
    throw error;
  }

  return { connectionString, containerName, publicBaseUrl };
}

function sanitizeFileName(fileName = "archivo") {
  const parsed = path.parse(fileName);
  const baseName = parsed.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "archivo";
  const extension = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 15);

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

async function getContainerClient() {
  const { connectionString, containerName } = getAzureConfig();
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  await containerClient.createIfNotExists();
  return containerClient;
}

async function uploadEvidenceFile(file, ordenId) {
  if (!file?.buffer) {
    const error = new Error("Archivo de evidencia no recibido");
    error.status = 400;
    throw error;
  }

  const { containerName, publicBaseUrl } = getAzureConfig();
  const containerClient = await getContainerClient();
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
  getContainerClient
};