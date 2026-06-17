function getDatabaseStatus() {
  return {
    configured: false,
    message: "Database connection is not configured yet"
  };
}

module.exports = {
  getDatabaseStatus
};
