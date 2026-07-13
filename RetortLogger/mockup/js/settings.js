/**
 * RetortLogger Mockup — settings interactions
 */

(function () {
  var btn = document.getElementById('btnSave');
  var msg = document.getElementById('msg');

  if (!btn) return;

  btn.addEventListener('click', function () {
    var pass = document.getElementById('lpass');
    if (pass && pass.value.length > 0 && pass.value.length < 6) {
      msg.textContent = 'Password minimal 6 karakter.';
      msg.className = 'msg er';
      return;
    }
    msg.textContent = 'Tersimpan. Restart...';
    msg.className = 'msg ok';
    btn.disabled = true;
    setTimeout(function () {
      msg.textContent = 'Simulasi: perangkat restart (mockup — tidak ada restart nyata).';
      btn.disabled = false;
    }, 2500);
  });
})();
