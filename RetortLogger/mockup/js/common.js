/**
 * RetortLogger Mockup — shared utilities
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateWIB(d) {
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}

function formatTimeWIB(d) {
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + ' WIB';
}

function formatLogTs(d) {
  var h = d.getHours();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ' ' +
    h + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + ampm;
}

function formatMs(totalSec) {
  var m = Math.floor(totalSec / 60);
  var s = totalSec % 60;
  return pad2(m) + ':' + pad2(s);
}

function formatFileSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(2) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function fmtCsvName(n) {
  var m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.csv$/i.exec(n);
  if (!m) return n;
  return m[3] + '-' + m[2] + '-' + m[1] + ' ' + m[4] + ':' + m[5] + ':' + m[6];
}

/** Live clock updater for dashboard */
function startClock(ids) {
  function tick() {
    var now = new Date();
    var elTime = document.getElementById(ids.time);
    var elDate = document.getElementById(ids.date);
    var elLog = document.getElementById(ids.log);
    if (elTime) elTime.textContent = formatTimeWIB(now);
    if (elDate) elDate.textContent = formatDateWIB(now);
    if (elLog) elLog.textContent = formatLogTs(now);
  }
  tick();
  setInterval(tick, 1000);
}

/** Toggle mockup info banner — press B key */
document.addEventListener('keydown', function (e) {
  if (e.key === 'b' || e.key === 'B') {
    var b = document.querySelector('.mock-banner');
    if (b) b.classList.toggle('hidden');
  }
});
