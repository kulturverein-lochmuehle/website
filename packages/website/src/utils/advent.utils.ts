// pure date arithmetic, imported by a page's script as well: no dependencies

const DAY = 24 * 60 * 60 * 1000;

/** The fourth Sunday of Advent: the last Sunday before Christmas Day, as a UTC midnight. */
function fourthAdvent(year: number): number {
  const christmas = Date.UTC(year, 11, 25);
  const weekday = new Date(christmas).getUTCDay();
  return christmas - (weekday === 0 ? 7 : weekday) * DAY;
}

/** Totensonntag: four weeks before the fourth Sunday of Advent - the Sunday before the first. */
export const totensonntag = (year: number): number => fourthAdvent(year) - 28 * DAY;

/**
 * Whether a day - its year, month one to twelve, and day of the month - lies
 * in the time before Christmas as the mill keeps it: from the day after
 * Totensonntag to Epiphany, the 6th of January.
 */
export function christmasTime(year: number, month: number, day: number): boolean {
  const date = Date.UTC(year, month - 1, day);
  return date > totensonntag(year) || (month === 1 && day <= 6);
}
