/**
 * MongoDB and data-store settings (no driver imports — safe to require from anywhere).
 * Override with env vars in production.
 */
module.exports = {
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/cmps369',
  dbName: process.env.MONGO_DB_NAME || 'cmps369',
  contactsCollection: process.env.MONGO_CONTACTS_COLLECTION || 'colon1'
};
