import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DATA } from '../demo-data.js';
import { SLEEP_BASELINE, initialState, recordForDay, evaluateSleep, validateCheckin, parseState, validDay } from '../health.js';

const entry = (day, sleepHours) => validateCheckin({ sleepHours }, day).record;
test('fixed seven-night fixture has the prescribed values and 7-hour median', () => {
  assert.deepEqual(DEMO_DATA.map(d => d.sleepHours), [7, 7.5, 6.5, 7, 7.25, 6.75, 7]);
  assert.equal(SLEEP_BASELINE, 7);
  assert.equal(DEMO_DATA.length, 7);
});
test('day 8 single short night logs; day 9 second short night triggers explained review', () => {
  const records = [...DEMO_DATA, entry(8, 5)];
  assert.equal(evaluateSleep(records, 8).status, 'Logged');
  records.push(entry(9, 5.5));
  const result = evaluateSleep(records, 9);
  assert.equal(result.status, 'Review sleep trend');
  assert.equal(result.baseline, 7);
  assert.deepEqual(result.readings, [{ day: 8, hours: 5 }, { day: 9, hours: 5.5 }]);
});
test('sleep rule requires the immediately preceding day and includes the exact 6-hour boundary', () => {
  assert.deepEqual(evaluateSleep([...DEMO_DATA, entry(8, 5), entry(10, 6)], 10).missingDays, [9]);
  assert.equal(evaluateSleep([entry(9, 6), entry(10, 6)], 10).status, 'Review sleep trend');
  assert.equal(evaluateSleep([entry(9, 6.01), entry(10, 6)], 10).status, 'Logged');
  assert.equal(evaluateSleep([entry(9, 0), entry(10, 0)], 10).status, 'Review sleep trend');
  assert.deepEqual(evaluateSleep([], 9).missingDays, [8, 9]);
});
test('partial check-ins retain nulls; zero sleep is a measurement', () => {
  const { record, errors } = validateCheckin({ sleepHours: '0', restingHeartRateBpm: '68', moodScore: '3', bodyTemperatureC: '36.7' }, 8);
  assert.deepEqual(errors, {});
  assert.equal(record.sleepHours, 0);
  assert.equal(record.moodScore, 3);
  assert.equal(record.bloodGlucoseMgDl, null);
  assert.equal(record.bloodPressureMmhg, null);
  assert.ok(validateCheckin({}, 8).errors.form);
});
test('sleep limits, finite decimal input and whole-number mood are validated', () => {
  for (const value of ['25', '-1', 'Infinity', 'NaN', '1e309', '0x10', 'abc', '<script>']) assert.ok(validateCheckin({ sleepHours: value }, 8).errors.sleepHours);
  for (const value of ['0', '24', '7.25']) assert.deepEqual(validateCheckin({ sleepHours: value }, 8).errors, {});
  for (const value of ['0', '6', '2.5']) assert.ok(validateCheckin({ moodScore: value }, 8).errors.moodScore);
  assert.deepEqual(validateCheckin({ bodyTemperatureC: '0' }, 8).errors, {});
});
test('blood pressure is paired and all required positive inputs are checked', () => {
  assert.ok(validateCheckin({ systolic: '118' }, 8).errors.bloodPressureMmhg);
  assert.ok(validateCheckin({ diastolic: '76' }, 8).errors.bloodPressureMmhg);
  assert.ok(validateCheckin({ systolic: 'abc', diastolic: '76' }, 8).errors.bloodPressureMmhg);
  assert.ok(validateCheckin({ systolic: '0', diastolic: '76' }, 8).errors.bloodPressureMmhg);
  assert.deepEqual(validateCheckin({ systolic: '118', diastolic: '76', bloodGlucoseMgDl: '90' }, 8).record.bloodPressureMmhg, { systolic: 118, diastolic: 76 });
  for (const key of ['restingHeartRateBpm', 'bloodGlucoseMgDl']) for (const value of ['0', '-1']) assert.ok(validateCheckin({ [key]: value }, 8).errors[key]);
});
test('editing replaces one day; fixture and baseline remain fixed; reset restores day 8', () => {
  const state = initialState();
  state.entries[8] = entry(8, 5); state.entries[8] = entry(8, 6);
  assert.equal(Object.keys(state.entries).length, 1);
  assert.equal(recordForDay(state, 8).sleepHours, 6);
  state.entries[1] = entry(1, 0);
  assert.equal(recordForDay(state, 1).sleepHours, 0);
  assert.equal(DEMO_DATA[0].sleepHours, 7);
  assert.equal(SLEEP_BASELINE, 7);
  assert.equal(initialState().selectedDay, 8);
  assert.equal(recordForDay(initialState(), 8), null);
  assert.equal(recordForDay(initialState(), 1).sleepHours, 7);
});
test('saved state round-trips selected day, zero values and pressure pairs', () => {
  const state = initialState(); state.selectedDay = 9;
  state.entries[8] = entry(8, 0);
  state.entries[9] = validateCheckin({ systolic: '118', diastolic: '76', moodScore: '3' }, 9).record;
  assert.deepEqual(parseState(JSON.stringify(state)), state);
  assert.deepEqual(parseState(null), initialState());
});
test('malformed storage is rejected before it can render', () => {
  for (const text of ['no json', '{}', 'null', JSON.stringify({ ...initialState(), selectedDay: 0 }), JSON.stringify({ ...initialState(), entries: [] }), JSON.stringify({ ...initialState(), entries: { 8: { ...entry(8, 7), sleepHours: '<svg>' } } }), JSON.stringify({ ...initialState(), entries: { 8: { ...entry(8, 7), bloodPressureMmhg: { systolic: '118', diastolic: 76 } } } })]) assert.throws(() => parseState(text));
});
test('mission-day navigation only accepts bounded integers', () => {
  for (const day of [0, -1, 2.5, NaN, Infinity, 10000]) assert.equal(validDay(day), false);
  for (const day of [1, 8, 9999]) assert.equal(validDay(day), true);
});
test('finite scientific values and negative temperatures survive a storage round-trip', () => {
  const state = initialState();
  const { record, errors } = validateCheckin({ bodyTemperatureC: '-2', bloodGlucoseMgDl: '1e100' }, 8);
  assert.deepEqual(errors, {}); state.entries[8] = record;
  assert.deepEqual(parseState(JSON.stringify(state)), state);
});
