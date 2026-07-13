/**
 * RetortLogger Mockup — storage page interactions
 */

(function () {
  var modal = document.getElementById('dm');
  var delName = document.getElementById('dn');
  var pendingRow = null;

  window.openDeleteModal = function (filename, row) {
    pendingRow = row;
    if (delName) delName.textContent = filename;
    if (modal) modal.className = 'modal show';
  };

  window.closeDeleteModal = function () {
    pendingRow = null;
    if (modal) modal.className = 'modal';
  };

  var btnCancel = document.getElementById('btnCancel');
  var btnConfirm = document.getElementById('btnConfirm');

  if (btnCancel) {
    btnCancel.addEventListener('click', closeDeleteModal);
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', function () {
      if (pendingRow && pendingRow.parentNode) {
        pendingRow.parentNode.removeChild(pendingRow);
      }
      closeDeleteModal();
    });
  }

  var btnLatest = document.getElementById('btnLatest');
  if (btnLatest) {
    btnLatest.addEventListener('click', function () {
      alert('Simulasi: mengunduh file CSV terbaru (20260628_143022.csv)');
    });
  }

  document.querySelectorAll('.btn-dl').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-file');
      alert('Simulasi: mengunduh ' + name);
    });
  });

  document.querySelectorAll('.btn-rm').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-file');
      var row = btn.closest('tr');
      openDeleteModal(name, row);
    });
  });
})();
