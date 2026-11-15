import { METRICS, MOODS, SLEEP_BASELINE, STORAGE_KEY, MAX_DAY, validDay, initialState, recordForDay, evaluateSleep, validateCheckin, parseState } from './health.js';

const $ = selector => document.querySelector(selector);
const icon = name => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const pad = day => String(day).padStart(3, '0');
const statusClass = status => status === 'Logged' ? 'logged' : status === 'Review sleep trend' ? 'review' : '';
let state, selectedMetric = METRICS[0], range = 14;
let storageWarning = '';
try { state = parseState(localStorage.getItem(STORAGE_KEY)); }
catch { state = initialState(); storageWarning = 'Saved data could not be read. The original demo is displayed. Saving a new check-in will replace unreadable data if storage is available.'; }

function setMessage(message, error = false) {
  $('#save-message').textContent = message;
  $('#save-message').className = `save-message${error ? ' error' : ''}`;
}
function persist(nextState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)); return true; }
  catch { setMessage('Could not save to browser storage. Your changes have not been saved. Allow site storage and try again.', true); return false; }
}
function allRecords() {
  // Only the two days being evaluated are needed, even for a very late mission day.
  return [state.selectedDay - 1, state.selectedDay].map(day => recordForDay(state, day)).filter(Boolean);
}
function metricValue(record, metric) {
  const value = record?.[metric.key];
  if (value === null || value === undefined) return '—';
  return metric.key === 'bloodPressureMmhg' ? `${value.systolic}/${value.diastolic}` : String(value);
}
function buildFields() {
  $('#form-fields').innerHTML = METRICS.map(metric => {
    const id = metric.key;
    let field;
    if (id === 'moodScore') field = `<label for="${id}">${metric.label} <span>1–5</span></label><select id="${id}" name="${id}" aria-describedby="error-${id}"><option value="">Select a rating</option>${MOODS.map((label, i) => `<option value="${i + 1}">${i + 1} · ${label}</option>`).join('')}</select>`;
    else if (id === 'bloodPressureMmhg') field = `<fieldset><legend>Blood pressure <span>mmHg</span></legend><div class="pressure-inputs">${['systolic', 'diastolic'].map(key => `<div><div class="input-wrap"><input id="${key}" name="${key}" type="text" inputmode="decimal" placeholder="${key === 'systolic' ? '118' : '76'}" aria-describedby="error-${id}"></div><label for="${key}">${key === 'systolic' ? 'Systolic' : 'Diastolic'}</label></div>`).join('<span aria-hidden="true">/</span>')}</div></fieldset>`;
    else field = `<label for="${id}">${metric.label}</label><div class="input-wrap"><input id="${id}" name="${id}" type="text" inputmode="decimal" placeholder="${({ sleepHours: '7.0', restingHeartRateBpm: '64', bodyTemperatureC: '36.6', bloodGlucoseMgDl: '90' })[id]}" aria-describedby="error-${id}"><span>${metric.unit}</span></div>`;
    return `<div class="field">${field}<p class="field-error" id="error-${id}"></p></div>`;
  }).join('');
}
function loadForm() {
  const record = recordForDay(state, state.selectedDay);
  for (const metric of METRICS) {
    if (metric.key === 'bloodPressureMmhg') {
      for (const key of ['systolic', 'diastolic']) $(`#${key}`).value = record?.bloodPressureMmhg?.[key] ?? '';
    } else $(`#${metric.key}`).value = record?.[metric.key] ?? '';
  }
  clearErrors();
}
function clearErrors() {
  document.querySelectorAll('.field .field-error').forEach(element => { element.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
}
function renderCards(sleep) {
  const record = recordForDay(state, state.selectedDay);
  $('#metric-cards').innerHTML = METRICS.map(metric => {
    const value = metricValue(record, metric);
    const status = metric.key === 'sleepHours' ? sleep.status : value === '—' ? 'Missing reading' : 'Logged';
    const mood = metric.key === 'moodScore' && value !== '—' ? ` · ${MOODS[Number(value) - 1]}` : '';
    return `<button type="button" class="metric-card${selectedMetric.key === metric.key ? ' selected' : ''}" data-metric="${metric.key}" aria-pressed="${selectedMetric.key === metric.key}"><span class="metric-top"><span class="metric-icon">${icon(metric.icon)}</span>${metric.label}<span class="card-arrow" aria-hidden="true">↗</span></span><span class="metric-value">${value}<small>${metric.unit}</small></span><span class="metric-status ${statusClass(status)}"><i aria-hidden="true"></i>${status}${mood}</span></button>`;
  }).join('');
}
function renderChart(sleep) {
  const metric = selectedMetric;
  const start = Math.max(1, state.selectedDay - range + 1);
  const days = Array.from({ length: state.selectedDay - start + 1 }, (_, i) => start + i);
  const records = days.map(day => recordForDay(state, day));
  const series = metric.key === 'bloodPressureMmhg'
    ? ['systolic', 'diastolic'].map((key, i) => ({ label: i ? 'Diastolic' : 'Systolic', color: i ? '#c27b55' : '#4779c5', values: records.map(record => record?.bloodPressureMmhg?.[key] ?? null) }))
    : [{ label: metric.label, color: '#4779c5', values: records.map(record => record?.[metric.key] ?? null) }];
  const values = series.flatMap(s => s.values).filter(v => v !== null);
  if (metric.key === 'sleepHours') values.push(SLEEP_BASELINE);
  // Normalize before axis arithmetic so every finite accepted number can render safely.
  const scale = Math.max(1, ...values.map(Math.abs));
  let low = values.length ? Math.min(...values) / scale : 0, high = values.length ? Math.max(...values) / scale : 10;
  const padding = Math.max((high - low) * .25, (metric.key === 'bodyTemperatureC' ? .2 : 1) / scale, .0001);
  const minimum = low;
  low = minimum >= 0 ? Math.max(0, low - padding) : low - padding; high += padding;
  if (metric.key === 'moodScore') { low = 1 / scale; high = 5 / scale; }
  // SVG coordinates scale to the panel; the table carries the same values accessibly.
  const width = 560, height = 215, left = 39, right = 15, top = 17, bottom = 31;
  const x = i => left + (days.length === 1 ? .5 : i / (days.length - 1)) * (width - left - right);
  const y = value => top + (high - value / scale) / (high - low) * (height - top - bottom);
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">${metric.label} history</title><desc id="chart-description">Mission days ${start} to ${state.selectedDay}. Missing readings are gaps. Exact readings are available in the table below.</desc>`;
  for (let i = 0; i < 5; i++) {
    const normalized = low + (high - low) * i / 4;
    const value = Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, normalized * scale));
    const yy = top + (high - normalized) / (high - low) * (height - top - bottom);
    const label = Math.abs(value) >= 10000 ? value.toExponential(0) : Number(value.toFixed(1));
    svg += `<line class="grid-line" x1="${left}" x2="${width - right}" y1="${yy}" y2="${yy}"/><text x="${left - 9}" y="${yy + 3}" text-anchor="end">${label}</text>`;
  }
  if (metric.key === 'sleepHours') svg += `<line class="baseline" x1="${left}" x2="${width - right}" y1="${y(SLEEP_BASELINE)}" y2="${y(SLEEP_BASELINE)}"/>`;
  const stride = Math.max(1, Math.ceil(days.length / 7));
  days.forEach((day, i) => {
    if (i % stride === 0 || i === days.length - 1) svg += `<text x="${x(i)}" y="${height - 9}" text-anchor="middle">D${day}</text>`;
  });
  for (const s of series) {
    let path = '', connected = false;
    s.values.forEach((value, i) => {
      if (value === null) { connected = false; return; }
      path += `${connected ? 'L' : 'M'}${x(i)},${y(value)} `; connected = true;
    });
    svg += `<path class="series" d="${path}" stroke="${s.color}"/>`;
    s.values.forEach((value, i) => {
      if (value !== null) svg += `<circle class="point" cx="${x(i)}" cy="${y(value)}" r="4" fill="${s.color}"><title>Day ${days[i]} · ${s.label}: ${value} ${metric.unit}</title></circle>`;
      else svg += `<text x="${x(i)}" y="${height - bottom - 6}" text-anchor="middle" aria-hidden="true">×</text>`;
    });
  }
  $('#chart').innerHTML = svg + '</svg>';
  $('#history-title').textContent = metric.label;
  $('#chart-unit').textContent = metric.chartUnit;
  const status = metric.key === 'sleepHours' ? sleep.status : metricValue(recordForDay(state, state.selectedDay), metric) === '—' ? 'Missing reading' : 'Logged';
  $('#chart-status').textContent = status;
  $('#chart-status').className = `status-chip ${statusClass(status)}`;
  $('#chart-legend').innerHTML = series.map(s => `<span class="legend-key" style="--series-color:${s.color}">${s.label}</span>`).join('') + (metric.key === 'sleepHours' ? `<span class="legend-key baseline-key">7 h baseline</span>` : '') + '<span>× Missing reading</span>';
  $('#table-caption').textContent = `${metric.label} · ${metric.unit}`;
  $('#table-head').innerHTML = `<tr><th scope="col">Mission day</th>${series.map(s => `<th scope="col">${s.label}</th>`).join('')}<th scope="col">Source</th></tr>`;
  $('#table-body').innerHTML = days.map((day, i) => `<tr${day === state.selectedDay ? ' class="current-row"' : ''}><th scope="row">Day ${day}</th>${series.map(s => `<td>${s.values[i] === null ? 'Missing reading' : s.values[i] + (metric.key === 'moodScore' ? ` · ${MOODS[s.values[i] - 1]}` : '')}</td>`).join('')}<td>${state.entries[day] ? 'Check-in' : day <= 7 ? 'Simulated baseline' : 'No entry'}</td></tr>`).join('');
}
function renderInsight(sleep) {
  const el = $('#sleep-insight');
  el.className = `sleep-insight ${statusClass(sleep.status)}`;
  const readings = sleep.readings.map(r => `Day ${r.day}: ${r.hours ?? 'missing'}${r.hours === null ? '' : ' hours'}`).join(' · ');
  let explanation;
  if (sleep.status === 'Review sleep trend') explanation = `${readings}. Both nights are at least 1 hour below the 7-hour baseline. Confirm these entries and note any schedule changes.`;
  else if (sleep.status === 'Missing reading') explanation = `Add sleep for ${sleep.missingDays.map(day => `day ${day}`).join(' and ')} to compare consecutive nights. The fixed baseline is 7 hours.`;
  else explanation = `${readings}. ${sleep.readings.length === 1 ? 'A second consecutive night is needed for a trend comparison.' : 'These consecutive nights do not trigger the demonstration rule.'}`;
  el.innerHTML = `<strong>${sleep.status}</strong><p>${explanation}</p>`;
}
function render(load = false) {
  const day = state.selectedDay, record = recordForDay(state, day);
  const sleep = evaluateSleep(allRecords(), day);
  $('#mission-day').value = day;
  $('#hero-day').textContent = pad(day);
  $('#hero-status').textContent = record ? 'Check-in saved' : 'Check-in due';
  $('#form-status').textContent = record ? 'Check-in saved' : 'Check-in due';
  $('#form-status').className = `status-chip${record ? ' logged' : ''}`;
  $('#form-day').textContent = `/ DAY ${pad(day)}`;
  $('#previous-day').disabled = day === 1;
  $('#next-day').disabled = day === MAX_DAY;
  renderCards(sleep); renderChart(sleep); renderInsight(sleep);
  if (load) loadForm();
}
function changeDay(day) {
  if (!validDay(day)) { $('#day-error').textContent = 'Choose a whole mission day from 1 to 9999.'; $('#mission-day').setAttribute('aria-invalid', 'true'); return; }
  $('#day-error').textContent = ''; $('#mission-day').removeAttribute('aria-invalid');
  setMessage('');
  const next = { ...state, selectedDay: day };
  persist(next); state = next; render(true);
}

buildFields(); render(true);
if (storageWarning) setMessage(storageWarning, true);
$('#mission-day').addEventListener('change', event => changeDay(Number(event.target.value)));
$('#previous-day').addEventListener('click', () => changeDay(state.selectedDay - 1));
$('#next-day').addEventListener('click', () => changeDay(state.selectedDay + 1));
$('#metric-cards').addEventListener('click', event => {
  const button = event.target.closest('[data-metric]');
  if (!button) return;
  selectedMetric = METRICS.find(metric => metric.key === button.dataset.metric);
  render();
  $(`[data-metric="${selectedMetric.key}"]`).focus({ preventScroll: true });
});
$('#history-range').addEventListener('change', event => { range = Number(event.target.value); renderChart(evaluateSleep(allRecords(), state.selectedDay)); });
$('#checkin-form').addEventListener('submit', event => {
  event.preventDefault(); clearErrors(); setMessage('');
  if (Number($('#mission-day').value) !== state.selectedDay || !validDay(Number($('#mission-day').value))) {
    $('#day-error').textContent = 'Choose a valid mission day before saving.'; $('#mission-day').focus(); return;
  }
  const { record, errors } = validateCheckin(Object.fromEntries(new FormData(event.target)), state.selectedDay);
  if (Object.keys(errors).length) {
    for (const [key, message] of Object.entries(errors)) {
      const target = $(`#error-${key}`);
      if (target) target.textContent = message;
      const fields = key === 'bloodPressureMmhg' ? ['systolic', 'diastolic'] : [key];
      fields.forEach(field => $(`#${field}`)?.setAttribute('aria-invalid', 'true'));
    }
    setMessage(errors.form ?? 'Check the highlighted fields and try again.', true);
    $('#checkin-form [aria-invalid]')?.focus(); return;
  }
  const next = { ...state, entries: { ...state.entries, [state.selectedDay]: record } };
  if (!persist(next)) return;
  state = next; render(); setMessage(`Day ${state.selectedDay} check-in saved. Your dashboard is up to date.`);
});
$('#reset').addEventListener('click', () => { $('#reset-dialog').returnValue = ''; $('#reset-dialog').showModal(); });
$('#reset-dialog').addEventListener('close', () => {
  if ($('#reset-dialog').returnValue !== 'reset') return;
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { setMessage('Could not reset browser storage. Your saved check-ins have been kept. Allow site storage and try again.', true); return; }
  state = initialState(); selectedMetric = METRICS[0];
  $('#day-error').textContent = ''; $('#mission-day').removeAttribute('aria-invalid');
  render(true); setMessage('Demo reset. Mission day 8 is ready, with the original seven baseline days restored.');
});
