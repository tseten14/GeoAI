var mymap;

// ── Pagination ──────────────────────────────────────────
var currentPage = 1;
var rowsPerPage = 5;

function getVisibleRows() {
  var table = document.getElementById("table");
  if (!table) return [];
  var allRows = table.querySelectorAll("tbody tr.tablerow");
  // When search is active, only consider rows not hidden by search
  var visible = [];
  allRows.forEach(function(row) {
    if (!row.dataset.searchHidden) {
      visible.push(row);
    }
  });
  return visible;
}

function paginateTable() {
  var rows = getVisibleRows();
  var totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  var start = (currentPage - 1) * rowsPerPage;
  var end = start + rowsPerPage;

  rows.forEach(function(row, idx) {
    if (idx >= start && idx < end) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  // Update page info
  var pageInfo = document.getElementById("pageInfo");
  if (pageInfo) {
    pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
  }

  // Disable/enable buttons
  var prevBtn = document.getElementById("prevPage");
  var nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function nextPage() {
  currentPage++;
  paginateTable();
}

function prevPage() {
  currentPage--;
  paginateTable();
}

// Initialize pagination on load
document.addEventListener("DOMContentLoaded", function() {
  paginateTable();
});


//Part 3: Adding Map - center on Mahwah, NJ area; use OSM tiles so map always displays
const MAHWAH_NJ = [41.089, -74.144];
const create_map = () => {
    mymap = L.map('mapid').setView(MAHWAH_NJ, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(mymap);

    var x = document.getElementsByClassName("tablerow");
    var bounds = [];

    for (var i = 0; i < x.length; i++) {
        var raw = x[i].getAttribute("dataobject");
        if (!raw) continue;
        // In case attribute was double-encoded, decode HTML entities (browser usually decodes once)
        raw = raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

        var obj;
        try {
            obj = JSON.parse(raw);
        } catch (err) {
            console.warn("Unable to parse row data", err, raw);
            continue;
        }

        var lat = parseFloat(obj.Latitude);
        var lng = parseFloat(obj.Longitude);
        if (isNaN(lat) || isNaN(lng)) continue;

        bounds.push([lat, lng]);
        var latLng = [lat, lng];

        // Add marker with popup (click marker to see contact info)
        var popupContent = (obj.Firstname || "") + " " + (obj.Lastname || "") + "<br>" +
            (obj.Email || "") + "<br>" + (obj.Street || "") + ", " + (obj.City || "");
        var marker = L.marker(latLng).addTo(mymap).bindPopup(popupContent);

        // Click row (except Delete/Update buttons) to fly map to that address and show marker popup
        (function (row, lat, lng, m) {
            row.style.cursor = "pointer";
            row.addEventListener("click", function (e) {
                if (e.target.closest("button") || e.target.closest("form")) return;
                mymap.flyTo([lat, lng], 14);
                m.openPopup();
            });
        })(x[i], lat, lng, marker);
    }

    if (bounds.length > 0) {
        mymap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
}

if (document.getElementById('mapid') && typeof L !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', create_map);
    } else {
        create_map();
    }
}

 //Part 7 Will Search for name
 function myname() {
  var input, filter, table, tr, td1, td2, i, txtValue;
  input = document.getElementById("inputfornames");
  filter = input.value.toUpperCase();
  table = document.getElementById("table");
  tr = table.querySelectorAll("tbody tr.tablerow");

  for (i = 0; i < tr.length; i++) {
    td1 = tr[i].getElementsByTagName("td")[1];
    td2 = tr[i].getElementsByTagName("td")[2];

    if (td1 || td2) {
      var txtValue1 = td1.textContent || td1.innerText;
      var txtValue2 = td2.textContent || td2.innerText;
      txtValue = txtValue1 + txtValue2;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        delete tr[i].dataset.searchHidden;
      } else {
        tr[i].dataset.searchHidden = "true";
        tr[i].style.display = "none";
      }
    }
  }
  currentPage = 1;
  paginateTable();
}

//Part 8
//Will search for address
function myaddress() {
  var input, filter, table, tr, i, txtValue;
  input = document.getElementById("inputforadd");
  filter = input.value.toUpperCase();
  table = document.getElementById("table");
  tr = table.querySelectorAll("tbody tr.tablerow");

  for (i = 0; i < tr.length; i++) {
    var td = tr[i].getElementsByTagName("td")[3];
    var td2 = tr[i].getElementsByTagName("td")[4];
    var td3 = tr[i].getElementsByTagName("td")[5];
    var td4 = tr[i].getElementsByTagName("td")[6];

    if (td || td2 || td3 || td4) {
      var txtValue1 = td.textContent || td.innerText;
      var txtValue2 = td2.textContent || td2.innerText;
      var txtValue3 = td3.textContent || td3.innerText;
      var txtValue4 = td4.textContent || td4.innerText;
      txtValue = txtValue1 + txtValue2 + txtValue3 + txtValue4;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        delete tr[i].dataset.searchHidden;
      } else {
        tr[i].dataset.searchHidden = "true";
        tr[i].style.display = "none";
      }
    }
  }
  currentPage = 1;
  paginateTable();
}

 
