const FEESTDAGEN_MAP = {
  "2026-12-25": "Christmas Day",
  "2026-12-26": "Second Day of Christmas",
  "2027-01-01": "New Year's Day",
  "2027-03-26": "Good Friday",
  "2027-03-29": "Easter Monday",
  "2027-04-26": "Collective Day Off",
  "2027-04-27": "King's Day",
  "2027-05-05": "Liberation Day",
  "2027-05-06": "Ascension Day",
  "2027-05-07": "Collective Day Off",
  "2027-05-17": "Whit Monday"
};

const FEESTDAGEN = new Set(Object.keys(FEESTDAGEN_MAP));

const VRIJE_ISO_WEEKS = new Set([32,33,34,35,52,53,18,26,27,28,29,30]);

const COURSE_COLORS = [
  "#c0392b","#8e44ad","#2980b9","#27ae60","#d35400",
  "#16a085","#2c3e50","#f39c12","#e91e63","#00bcd4"
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const YEAR_LABELS = ["Year 1","Year 2","Year 3","Unassigned"];