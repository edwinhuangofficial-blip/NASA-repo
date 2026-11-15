import { DEMO_DATA } from './demo-data.js';

export const MOODS = ['Very low', 'Low', 'Neutral', 'Good', 'Very good'];
export const METRICS = [
  { key: 'sleepHours', label: 'Sleep duration', unit: 'hours', icon: 'moon', chartUnit: 'HOURS SLEPT' },
  { key: 'restingHeartRateBpm', label: 'Resting heart rate', unit: 'bpm', icon: 'heart', chartUnit: 'BEATS / MINUTE' },
  { key: 'moodScore', label: 'Mood', unit: '/ 5', icon: 'mood', chartUnit: 'SELF-RATING / 5' },
  { key: 'bloodPressureMmhg', label: 'Blood pressure', unit: 'mmHg', icon: 'pressure', chartUnit: 'PRESSURE / mmHg' },
  { key: 'bodyTemperatureC', label: 'Body temperature', unit: '°C', icon: 'temperature', chartUnit: 'TEMPERATURE / °C' },
  { key: 'bloodGlucoseMgDl', label: 'Blood glucose', unit: 'mg/dL', icon: 'drop', chartUnit: 'GLUCOSE / mg/dL' },
];
const sortedSleep = DEMO_DATA.map(d => d.sleepHours).sort((a, b) => a - b);
export const SLEEP_BASELINE = sortedSleep[3];
export const STORAGE_KEY = 'astra.crew-health.v1';
export const MAX_DAY = 9999;
export function validDay(day) { return Number.isInteger(day) && day >= 1 && day <= MAX_DAY; }
export function initialState() { return { version: 1, selectedDay: 8, entries: {} }; }
export function recordForDay(state, day) { return state.entries[day] ?? DEMO_DATA.find(r => r.missionDay === day) ?? null; }
export function evaluateSleep(records, selectedDay, baseline = SLEEP_BASELINE) {
  const days = selectedDay === 1 ? [1] : [selectedDay - 1, selectedDay];
  const readings = days.map(day => ({ day, hours: records.find(r => r.missionDay === day)?.sleepHours ?? null }));
  const missingDays = readings.filter(r => r.hours === null || !Number.isFinite(r.hours)).map(r => r.day);
  if (missingDays.length) return { status: 'Missing reading', readings, missingDays, baseline };
  const review = readings.length === 2 && readings.every(r => r.hours <= baseline - 1);
  return { status: review ? 'Review sleep trend' : 'Logged', readings, missingDays, baseline };
}
export function validateCheckin(raw, missionDay) {
  const errors = {};
  const read = (key) => {
    const text = String(raw[key] ?? '').trim();
    if (!text) return null;
    // Reject non-decimal notation and non-finite values; zero remains a reading.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) {
      errors[key] = 'Enter a finite number.'; return null;
    }
    return Number(text);
  };
  const record = { missionDay };
  for (const m of METRICS.filter(m => m.key !== 'bloodPressureMmhg')) record[m.key] = read(m.key);
  const systolic = read('systolic'), diastolic = read('diastolic');
  if (record.sleepHours !== null && (record.sleepHours < 0 || record.sleepHours > 24)) errors.sleepHours = 'Enter sleep from 0 to 24 hours.';
  if (record.moodScore !== null && (!Number.isInteger(record.moodScore) || record.moodScore < 1 || record.moodScore > 5)) errors.moodScore = 'Choose a whole-number rating from 1 to 5.';
  for (const key of ['restingHeartRateBpm', 'bloodGlucoseMgDl']) if (record[key] !== null && record[key] <= 0) errors[key] = 'Enter a value greater than 0.';
  const hasSystolic = String(raw.systolic ?? '').trim() !== '', hasDiastolic = String(raw.diastolic ?? '').trim() !== '';
  if (hasSystolic !== hasDiastolic) errors.bloodPressureMmhg = 'Enter both systolic and diastolic readings.';
  if ((systolic !== null && systolic <= 0) || (diastolic !== null && diastolic <= 0)) errors.bloodPressureMmhg = 'Both pressure readings must be greater than 0.';
  if (errors.systolic || errors.diastolic) errors.bloodPressureMmhg = 'Enter finite numbers for both pressure readings.';
  record.bloodPressureMmhg = systolic === null || diastolic === null ? null : { systolic, diastolic };
  if (METRICS.every(m => record[m.key] === null) && !Object.keys(errors).length) errors.form = 'Enter at least one measurement to save a check-in.';
  if (!validDay(missionDay)) errors.form = 'Choose a whole mission day from 1 to 9999.';
  return { record, errors };
}
export function parseState(text) {
  if (text === null) return initialState();
  const state = JSON.parse(text);
  if (!state || state.version !== 1 || !validDay(state.selectedDay) || !state.entries || typeof state.entries !== 'object' || Array.isArray(state.entries)) throw new Error('Invalid saved data');
  const entries = {};
  for (const [key, entry] of Object.entries(state.entries)) {
    const day = Number(key);
    if (!validDay(day) || String(day) !== key || !entry || entry.missionDay !== day) throw new Error('Invalid saved entry');
    for (const metric of METRICS) {
      const v = entry[metric.key];
      if (v === null) continue;
      if (metric.key === 'bloodPressureMmhg') {
        if (!v || typeof v.systolic !== 'number' || typeof v.diastolic !== 'number') throw new Error('Invalid saved pressure');
      } else if (typeof v !== 'number') throw new Error('Invalid saved value');
    }
    const result = validateCheckin({ ...entry, systolic: entry.bloodPressureMmhg?.systolic, diastolic: entry.bloodPressureMmhg?.diastolic }, day);
    if (Object.keys(result.errors).length) throw new Error('Invalid saved entry');
    entries[day] = result.record;
  }
  return { version: 1, selectedDay: state.selectedDay, entries };
}
