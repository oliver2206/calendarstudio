export const DEFAULTS = {
  company: 'Your Company Name',
  tagline: 'Quality you can trust',
  coverLabel: 'WALL CALENDAR',
  verse: 'Very soon you will smile and say God, this is more than I prayed for.',
  verseRef: 'PHILIPPIANS 4:19',
  phone: '+00 000 000 0000',
  email: 'hello@yourcompany.com',
  website: 'www.yourcompany.com',
  address: '123 Main Street, Your City',
  owner: '',

  year: 2027,
  template: 'classic',
  weekStart: 0,
  showHolidays: true,
  sharedCell: 'template', // template | diagonal | corners | slash | stacked  (24/31 cell on 6-week months)
  holidayStyle: 'classic', // classic | faded | across | diagonal
  showAdj: false,
  // Philippine-style template extras
  showMoon: true,
  utcOffset: 8,
  showTides: true,
  showLunar: true,
  tides: '',
  almanac: '',
  holidaysTitle: 'LEGAL HOLIDAYS',
  reminders: '',
  remindersTitle: 'REMINDERS',
  holidays: "01-01 New Year's Day\n05-01 Labor Day\n12-25 Christmas Day\n12-31 New Year's Eve",

  pageSize: 'A4',
  orientation: 'portrait',
  bleed: 0,

  headingFont: 'Georgia',
  bodyFont: 'Arial',
  primary: '#1f3a5f',
  accent: '#f2a900',
  text: '#1c1c1c',
  bg: '#ffffff',
  weekend: '#d64545',

  photoZoom: 1,
  photoFx: 0.5,
  photoFy: 0.5,

  // colour theme (highlight = A, main = B); empty = each template's own colours
  themeA: '',
  themeB: '',
  moonSet: 1,
  moonPos: 'template', // template | stack | facetop | textleft | textright  (where the moon name / face / date sit in a moon cell)

  // page border + grid lines
  borderStyle: 'template', // template | none | line | double | rounded | pattern | artwork  (+ '+h' = with horizontal line)
  borderFollow: true, // follow the colour theme (Main colour)
  borderColor: '#111111',
  hlineOffset: 0, // move the horizontal line up (-) / down (+)
  borderParts: 'only', // only | line | double  (extra line(s) inside a pattern / artwork border)
  borderLineFollow: true, // line colour = border colour
  borderLineColor: '#d4141c',
  borderWidth: 4,
  borderInset: 6,
  gridFollow: true,
  gridColor: '#111111',
  gridWidth: 0, // 0 = template's own thickness

  dpi: 150,
  editableText: true,
};
