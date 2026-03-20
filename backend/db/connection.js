const path = require('path');
const { MongoClient } = require('mongodb');
const config = require(path.join(__dirname, '../../database/config'));

let contacts = null;

async function connect() {
  try {
    const client = await MongoClient.connect(config.mongoUrl, { useUnifiedTopology: true });
    const db = client.db(config.dbName);
    contacts = db.collection(config.contactsCollection);
    console.log('MongoDB connected');
  } catch (ex) {
    console.error('MongoDB connection failed:', ex);
  }
}

const dbReady = connect();

module.exports = {
  dbReady,
  getContacts: () => contacts
};
