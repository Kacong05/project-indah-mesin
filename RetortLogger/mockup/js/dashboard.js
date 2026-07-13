/**
 * RetortLogger Mockup — dashboard live simulation
 */

(function () {
  var state = {
    temp: 121.3,
    setpoint: 121.0,
    phase: 'HOLDING',
    mv: 42.5,
    logging: true,
    run: true,
    totSec: 1847,
    stpSec: 432,
    ps: '2-01',
    direction: 1
  };

  function applyTempBar(temp) {
    var bar = document.getElementById('tbar');
    if (!bar) return;
    var pct = Math.min(100, Math.max(0, temp / 130 * 100));
    bar.style.width = pct + '%';
    bar.className = 'tfill';
    if (temp > 126) bar.classList.add('er');
    else if (temp >= 116 && temp <= 126) { /* green default */ }
    else if (temp >= 100) bar.classList.add('wr');
  }

  function render() {
    state.temp += state.direction * (0.05 + Math.random() * 0.15);
    if (state.temp >= 121.8) state.direction = -1;
    if (state.temp <= 120.6) state.direction = 1;

    state.mv = 38 + Math.sin(Date.now() / 3000) * 8 + Math.random() * 2;
    state.totSec += 1;
    if (state.stpSec > 0) state.stpSec -= 1;

    var tbig = document.getElementById('tbig');
    if (tbig) tbig.innerHTML = state.temp.toFixed(1) + '<span>°C</span>';

    applyTempBar(state.temp);

    var tsp = document.getElementById('tsp');
    if (tsp) tsp.textContent = state.setpoint.toFixed(1) + '°C';

    var tph = document.getElementById('tph');
    if (tph) tph.textContent = state.phase;

    var trec = document.getElementById('trec');
    if (trec) trec.textContent = state.logging ? '● REC' : (state.run ? 'RUN' : 'idle');

    var phase = document.getElementById('phase');
    if (phase) {
      phase.textContent = state.phase;
      phase.className = 'v ' + (state.logging ? 'wr' : 'ok');
    }

    var mv = document.getElementById('mv');
    if (mv) {
      mv.textContent = state.mv.toFixed(1) + '%';
      mv.className = 'v ' + (state.mv > 0 ? 'wr' : '');
    }

    var tot = document.getElementById('tot');
    if (tot) tot.textContent = formatMs(state.totSec);

    var stp = document.getElementById('stp');
    if (stp) stp.textContent = formatMs(state.stpSec);

    var ps = document.getElementById('ps');
    if (ps) ps.textContent = state.ps;
  }

  startClock({ time: 'clkTime', date: 'clkDate', log: 'clkLog' });
  render();
  setInterval(render, 2000);
})();
