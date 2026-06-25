const app = require("./app");

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error("[Config] JWT_SECRET no esta configurado. Define JWT_SECRET en backend/.env o variables de entorno.");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`SerialCare backend running on port ${PORT}`);
});