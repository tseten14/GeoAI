# Database

- **MongoDB** — connection URL and database/collection names live in `config.js` (or set `MONGO_URL`, `MONGO_DB_NAME`, `MONGO_CONTACTS_COLLECTION`).
- **Runtime connection** — opened from the API in `../backend/db/connection.js` when the server starts.

### Local MongoDB

```bash
# Default URL matches config: mongodb://localhost:27017/cmps369
mongod --dbpath /path/to/data
```

Contacts are stored in database `cmps369`, collection `colon1` (same as the original app).
