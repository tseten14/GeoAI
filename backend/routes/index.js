
//Route for all contact deletion, addition, and CRUD
var express = require('express');
var router = express.Router();
var passport = require('passport');
const https = require('https');
var ObjectID = require('mongodb').ObjectID;
const { dbReady, getContacts } = require('../db/connection');

function col() {
  return getContacts();
}

var ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

// Promise-based https get (Node < 18 has no global fetch). options can include { headers: {} }
function httpsGet(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options || {}, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, json: () => Promise.resolve(JSON.parse(data)) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

// Geocode a single address; returns { latitude, longitude } or null. Tries Mapbox, then Nominatim (OSM).
async function geocodeAddress(street, city, state) {
  const s = String(street || '').trim();
  const c = String(city || '').trim();
  if (!s || !c) return null;

  if (ACCESS_TOKEN) {
    try {
      const mapboxUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/'
        + encodeURIComponent(s + ', ' + c + (state ? ', ' + state : '')) + '.json?access_token=' + ACCESS_TOKEN + '&limit=1';
      const response = await httpsGet(mapboxUrl);
      if (response.ok) {
        const body = await response.json();
        if (body && body.features && body.features.length > 0) {
          return {
            latitude: body.features[0].center[1],
            longitude: body.features[0].center[0]
          };
        }
      }
    } catch (e) {
      // fall through to Nominatim
    }
  }

  try {
    const query = encodeURIComponent([s, c, state].filter(Boolean).join(', '));
    const nominatimUrl = 'https://nominatim.openstreetmap.org/search?q=' + query + '&format=json&limit=1';
    const response = await httpsGet(nominatimUrl, {
      headers: { 'User-Agent': 'GeocodedContactList/1.0 (contact list app)' }
    });
    if (response.ok) {
      const body = await response.json();
      if (Array.isArray(body) && body.length > 0 && body[0].lat != null && body[0].lon != null) {
        return {
          latitude: parseFloat(body[0].lat),
          longitude: parseFloat(body[0].lon)
        };
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

var ensureLoggedIn = function (req, res, next) {
  if (req.user) {
    next();
  } else {
    res.status(401).json({ error: 'unauthorized' });
  }
};

function normalizePost(post_data) {
  var copy = Object.assign({}, post_data);
  if (copy.checkall === 'on' || copy.checkall === true) {
    copy.checkemail = 'on';
    copy.checkmail = 'on';
    copy.checkphone = 'on';
  }
  return copy;
}

/** Persist contact (insert or update). Returns { ok, id? } or { ok: false, error }. */
async function persistContact(post_data, type) {
  post_data = normalizePost(post_data);
  let latitude = null;
  let longitude = null;

  try {
    const hasAddress = post_data.Street && post_data.City &&
      String(post_data.Street).trim() !== '' && String(post_data.City).trim() !== '';

    if (hasAddress) {
      const geocodeUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/'
        + encodeURIComponent(post_data.Street + ',' + post_data.City + ',') + '.json?access_token='
        + ACCESS_TOKEN + '&limit=1';

      try {
        const response = await httpsGet(geocodeUrl);
        if (response.ok) {
          const body = await response.json();
          if (body && body.features && body.features.length > 0) {
            longitude = body.features[0].center[0];
            latitude = body.features[0].center[1];
          }
        }
      } catch (geoErr) {
        console.log('Geocode failed (contact will still be saved):', geoErr.message);
      }
    }

    if (!col()) {
      console.error('Database not ready');
      return { ok: false, error: 'database' };
    }

    function onVal(v) {
      return (v === 'on' || v === true) ? 'on' : '';
    }
    const doc = {
      Firstname: post_data.Firstname || '', Lastname: post_data.Lastname || '',
      Street: post_data.Street || '', City: post_data.City || '', State: post_data.State || '', Zip: post_data.Zip || '',
      Phone: post_data.Phone || '', Email: post_data.Email || '', Prefix: post_data.Prefix || '',
      contactbymail: onVal(post_data.checkmail), Contactbyphone: onVal(post_data.checkphone),
      Contactbyemail: onVal(post_data.checkemail), Latitude: latitude, Longitude: longitude
    };

    if (type === 'insert') {
      const result = await col().insertOne(doc);
      return { ok: true, id: result.insertedId.toString() };
    }

    if (type === 'update') {
      var myquery = { '_id': ObjectID(post_data.mongoID) };
      await col().updateOne(myquery, { $set: doc });
      return { ok: true, id: post_data.mongoID };
    }

    return { ok: false, error: 'bad_type' };
  } catch (err) {
    console.error('persistContact error:', err);
    return { ok: false, error: 'server' };
  }
}

function serializeContact(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    Firstname: doc.Firstname,
    Lastname: doc.Lastname,
    Street: doc.Street,
    City: doc.City,
    State: doc.State,
    Zip: doc.Zip,
    Phone: doc.Phone,
    Email: doc.Email,
    Prefix: doc.Prefix,
    contactbymail: doc.contactbymail,
    Contactbyphone: doc.Contactbyphone,
    Contactbyemail: doc.Contactbyemail,
    Latitude: doc.Latitude,
    Longitude: doc.Longitude
  };
}

async function loadContactsWithBackfill() {
  if (!col()) return null;
  const docs = await col().find().toArray();
  for (const doc of docs) {
    const hasCoords = doc.Latitude != null && doc.Longitude != null &&
      doc.Latitude !== '' && doc.Longitude !== '';
    const hasAddress = doc.Street && doc.City &&
      String(doc.Street).trim() !== '' && String(doc.City).trim() !== '';
    if (!hasCoords && hasAddress) {
      const coords = await geocodeAddress(doc.Street, doc.City, doc.State);
      if (coords) {
        await col().updateOne(
          { _id: doc._id },
          { $set: { Latitude: coords.latitude, Longitude: coords.longitude } }
        );
        doc.Latitude = coords.latitude;
        doc.Longitude = coords.longitude;
      }
    }
  }
  return docs.map(serializeContact);
}

// ——— API ———

router.post('/api/auth/login', function (req, res, next) {
  passport.authenticate('local', function (err, user) {
    if (err) return res.status(500).json({ error: 'server' });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    req.logIn(user, function (loginErr) {
      if (loginErr) return res.status(500).json({ error: 'session' });
      return res.json({ ok: true });
    });
  })(req, res, next);
});

router.post('/api/auth/logout', function (req, res) {
  try {
    req.logout(function () { });
  } catch (e) { /* ignore */ }
  if (req.session) {
    req.session.destroy(function () {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  } else {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  }
});

router.get('/api/auth/me', function (req, res) {
  res.json({ user: req.user ? true : null });
});

router.get('/api/contacts', ensureLoggedIn, async function (req, res) {
  try {
    const list = await loadContactsWithBackfill();
    if (list === null) {
      return res.status(503).json({ error: 'database_unavailable' });
    }
    res.json({ contacts: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
});

router.get('/api/contacts/:id', ensureLoggedIn, async function (req, res) {
  if (!ObjectID.isValid(req.params.id)) {
    return res.status(400).json({ error: 'invalid_id' });
  }
  try {
    const doc = await col().findOne({ _id: ObjectID(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.json({ contact: serializeContact(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
});

router.post('/api/contacts', ensureLoggedIn, async function (req, res) {
  const result = await persistContact(req.body, 'insert');
  if (!result.ok) {
    return res.status(result.error === 'database' ? 503 : 500).json({ error: result.error || 'save_failed' });
  }
  res.status(201).json({ ok: true, id: result.id });
});

router.put('/api/contacts/:id', ensureLoggedIn, async function (req, res) {
  if (!ObjectID.isValid(req.params.id)) {
    return res.status(400).json({ error: 'invalid_id' });
  }
  const body = Object.assign({}, req.body, { mongoID: req.params.id });
  const result = await persistContact(body, 'update');
  if (!result.ok) {
    return res.status(result.error === 'database' ? 503 : 500).json({ error: result.error || 'save_failed' });
  }
  res.json({ ok: true });
});

router.delete('/api/contacts/:id', ensureLoggedIn, async function (req, res) {
  if (!ObjectID.isValid(req.params.id)) {
    return res.status(400).json({ error: 'invalid_id' });
  }
  try {
    const r = await col().deleteOne({ _id: ObjectID(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
});

// Legacy GET /logout (bookmark / direct link)
router.get('/logout', function (req, res) {
  try {
    req.logout(function () { });
  } catch (e) { /* ignore */ }
  if (req.session) {
    req.session.destroy(function () {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  } else {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  }
});

router.dbReady = dbReady;
module.exports = router;
