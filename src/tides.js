// Tide table parser. One line per day:
//   YYYY-MM-DD | high tides | low tides        (the year is optional: MM-DD | ... | ...)
// Tides are separated by ; or , e.g.
//   2027-01-01 | 4:25 AM 0.8m, 5:35 PM 1.2m | 10:20 AM 0.3m
// Tide times are NOT calculated by this app: paste them from your local tide table (PAGASA / NAMRIA).
export function parseTides(src, year) {
  const map = {};
  String(src || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s*\|([^|]*)\|?(.*)$/);
    if (!m) return;
    if (m[1] && Number(m[1]) !== Number(year)) return;
    const list = (s) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    map[`${Number(m[2])}-${Number(m[3])}`] = { high: list(m[4]), low: list(m[5]) };
  });
  return map;
}

// January 2027 as printed on the sample calendar supplied by the user (use it to check the layout).
export const TIDES_JAN_2027 = [
  '2027-01-01 | 4:25 AM 0.8m, 5:35 PM 1.2m | 10:20 AM 0.3m',
  '2027-01-02 | 5:59 AM 0.5m, 6:35 PM 1.3m | 1:10 AM 0.4m, 10:34 AM 0.4m',
  '2027-01-03 | 9:55 AM 0.5m, 7:36 PM 1.3m | 3:05 AM 0.2m, 10:11 AM 0.4m',
  '2027-01-04 | 8:34 PM 1.4m | 4:08 AM 0.1m',
  '2027-01-05 | 11:50 AM 0.6m, 9:24 PM 1.5m | 4:49 AM -0.1m, 1:42 PM 0.5m',
  '2027-01-06 | 12:00 PM 0.6m, 10:08 PM 1.6m | 5:23 AM -0.2m, 3:00 PM 0.5m',
  '2027-01-07 | 12:16 PM 0.7m, 10:48 PM 1.7m | 5:54 AM -0.2m, 3:53 PM 0.5m',
  '2027-01-08 | 12:36 PM 0.7m, 11:25 PM 1.7m | 6:23 AM -0.3m, 4:37 PM 0.4m',
  '2027-01-09 | 12:58 PM 0.7m, 11:59 PM 1.7m | 6:51 AM -0.3m, 5:16 PM 0.4m',
  '2027-01-10 | 1:22 PM 0.8m | 7:18 AM -0.3m, 5:53 PM 0.3m',
  '2027-01-11 | 12:31 AM 1.7m, 1:47 PM 0.8m | 7:45 AM -0.2m, 6:30 PM 0.3m',
  '2027-01-12 | 1:03 AM 1.6m, 2:12 PM 0.9m | 8:09 AM -0.2m, 7:09 PM 0.3m',
  '2027-01-13 | 1:35 AM 1.5m, 2:38 PM 0.9m | 8:32 AM -0.1m, 7:52 PM 0.3m',
  '2027-01-14 | 2:09 AM 1.3m, 3:06 PM 1.0m | 8:54 AM 0.0m, 8:43 PM 0.3m',
  '2027-01-15 | 2:46 AM 1.1m, 3:37 PM 1.1m | 9:12 AM 0.2m, 9:49 PM 0.3m',
  '2027-01-16 | 3:32 AM 0.9m, 4:17 PM 1.2m | 9:28 AM 0.3m, 11:23 PM 0.3m',
  '2027-01-17 | 4:42 AM 0.6m, 5:10 PM 1.3m | 9:36 AM 0.4m',
  '2027-01-18 | 6:22 PM 1.4m | 1:36 AM 0.2m',
  '2027-01-19 | 7:43 PM 1.5m | 3:22 AM 0.0m',
  '2027-01-20 | 8:55 PM 1.7m | 4:24 AM -0.2m',
  '2027-01-21 | 12:14 PM 0.6m, 9:56 PM 1.8m | 5:10 AM -0.4m, 2:37 PM 0.5m',
  '2027-01-22 | 12:23 PM 0.7m, 10:49 PM 1.9m | 5:50 AM -0.5m, 3:53 PM 0.5m',
  '2027-01-23 | 12:42 PM 0.7m, 11:37 PM 1.9m | 6:26 AM -0.5m, 4:52 PM 0.3m',
  '2027-01-24 | 1:05 PM 0.8m | 6:59 AM -0.5m, 5:45 PM 0.2m',
  '2027-01-25 | 12:22 AM 1.9m, 1:30 PM 0.9m | 7:29 AM -0.4m, 6:35 PM 0.1m',
  '2027-01-26 | 1:04 AM 1.7m, 1:57 PM 1.0m | 7:55 AM -0.3m, 7:26 PM 0.1m',
  '2027-01-27 | 1:43 AM 1.5m, 2:26 PM 1.2m | 8:17 AM -0.1m, 8:18 PM 0.1m',
  '2027-01-28 | 2:21 AM 1.2m, 2:57 PM 1.2m | 8:36 AM 0.0m, 9:14 PM 0.2m',
  '2027-01-29 | 2:58 AM 0.9m, 3:31 PM 1.3m | 8:48 AM 0.2m, 10:21 PM 0.3m',
  '2027-01-30 | 3:35 AM 0.7m, 4:10 PM 1.3m | 8:53 AM 0.3m',
  '2027-01-31 | 4:21 AM 0.4m, 5:04 PM 1.3m | 12:01 AM 0.3m, 8:36 AM 0.3m',
].join('\n');
