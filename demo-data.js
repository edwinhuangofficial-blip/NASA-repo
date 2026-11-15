// Fixed, entirely fictional readings. Never use edited entries to recalculate this baseline.
export const DEMO_DATA = Object.freeze([
  [7, 64, 4, 118, 76, 36.6, 88],
  [7.5, 62, 4, 116, 75, 36.7, 91],
  [6.5, 66, 3, 120, 78, 36.5, 86],
  [7, 63, 4, 117, 76, 36.6, 90],
  [7.25, 65, 5, 119, 77, 36.8, 92],
  [6.75, 64, 4, 118, 75, 36.7, 89],
  [7, 62, 4, 116, 74, 36.6, 87],
].map((v, i) => Object.freeze({
  missionDay: i + 1, sleepHours: v[0], restingHeartRateBpm: v[1], moodScore: v[2],
  bloodPressureMmhg: Object.freeze({ systolic: v[3], diastolic: v[4] }),
  bodyTemperatureC: v[5], bloodGlucoseMgDl: v[6],
})));
