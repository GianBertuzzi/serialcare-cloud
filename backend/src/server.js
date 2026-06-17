const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SerialCare backend running on port ${PORT}`);
});
