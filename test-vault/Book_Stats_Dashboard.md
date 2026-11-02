# Books

```dataviewjs
const root = this.container.createDiv({ cls: "book-dashboard" });
const style = document.createElement("style");
style.textContent = `
.book-dashboard{--bd-accent:var(--interactive-accent);--bd-bg:var(--background-secondary);--bd-border:var(--background-modifier-border);color:var(--text-normal)}
.book-dashboard *{box-sizing:border-box}.book-dashboard .hero{padding:24px;border:1px solid var(--bd-border);border-radius:20px;background:linear-gradient(125deg,var(--background-secondary),var(--background-primary));margin-bottom:18px}
.book-dashboard h1,.book-dashboard h2,.book-dashboard h3{margin:0;color:var(--text-normal)}.book-dashboard h1{font-size:2em;line-height:1.15}.book-dashboard h2{font-size:1.3em;margin-bottom:5px}.book-dashboard h3{font-size:1em;margin-bottom:12px}
.book-dashboard .eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.7em;font-weight:700;color:var(--bd-accent);margin-bottom:8px}.book-dashboard .muted{color:var(--text-muted);font-size:.88em}.book-dashboard .hero .muted{margin-top:8px}
.book-dashboard .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:16px 0}.book-dashboard .card,.book-dashboard .panel{background:var(--bd-bg);border:1px solid var(--bd-border);border-radius:15px;padding:16px;min-width:0}
.book-dashboard .value{font-size:1.8em;font-weight:750;line-height:1.1;font-variant-numeric:tabular-nums}.book-dashboard .label{color:var(--text-muted);font-size:.78em;margin-top:5px}.book-dashboard .detail{color:var(--text-faint);font-size:.74em;margin-top:5px}
.book-dashboard .section{margin:27px 0 12px}.book-dashboard .panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;margin:12px 0}.book-dashboard .wide{grid-column:1/-1}
.book-dashboard .bar-row{display:grid;grid-template-columns:minmax(80px,130px) 1fr auto;align-items:center;gap:9px;margin:9px 0;font-size:.85em}.book-dashboard .bar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.book-dashboard .track{height:8px;border-radius:9px;background:var(--background-modifier-border);overflow:hidden}.book-dashboard .fill{height:100%;background:var(--bd-accent);border-radius:9px}.book-dashboard .bar-value{font-variant-numeric:tabular-nums;color:var(--text-muted)}
.book-dashboard .table-wrap{overflow-x:auto}.book-dashboard table{width:100%;border-collapse:collapse;font-size:.86em}.book-dashboard th,.book-dashboard td{text-align:left;padding:8px;border-bottom:1px solid var(--bd-border);vertical-align:top}.book-dashboard th{color:var(--text-muted);font-size:.8em}.book-dashboard .empty{color:var(--text-muted);font-size:.88em;padding:8px 0}.book-dashboard a.internal-link{color:var(--link-color)}
`;
root.appendChild(style);

const books = dv.pages('"Resources/Bases/Books"').array();
const now = dv.luxon.DateTime.local();
const year = now.year;
const number = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const date = value => {
  if (!value) return null;
  const result = dv.date(value);
  return result?.isValid ? result : null;
};
const values = value => (Array.isArray(value) ? value : value == null ? [] : [value])
  .map(v => String(v).trim()).filter(Boolean);
const isFinished = book => book.status === "finished";
const finished = books.filter(isFinished);
const backlog = books.filter(book => book.status === "tbd");
const dated = finished.map(book => ({book, finish: date(book.dateFinished), start: date(book.dateStarted)}))
  .filter(item => item.finish);
const thisYear = dated.filter(item => item.finish.year === year);
const withPages = list => list.filter(book => number(book.pages) !== null && book.pages >= 0);
const sumPages = list => withPages(list).reduce((sum, book) => sum + book.pages, 0);
const formatNumber = value => new Intl.NumberFormat().format(value);
const round = (value, places = 1) => Number(value.toFixed(places));
const countValues = (list, field) => {
  const counts = new Map();
  for (const book of list) {
    for (const value of new Set(values(book[field]))) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const releaseYear = value => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})(?:$|-)/);
    return match ? Number(match[1]) : null;
  }
  const parsed = date(value);
  return parsed ? parsed.year : null;
};
const el = (parent, tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = String(text);
  parent.appendChild(node);
  return node;
};
const section = (title, subtitle) => {
  const head = el(root, "div", "section");
  el(head, "h2", null, title);
  if (subtitle) el(head, "div", "muted", subtitle);
};
const grid = () => el(root, "div", "grid");
const card = (parent, value, label, detail) => {
  const box = el(parent, "div", "card");
  el(box, "div", "value", value);
  el(box, "div", "label", label);
  if (detail) el(box, "div", "detail", detail);
};
const panels = () => el(root, "div", "panels");
const panel = (parent, title, subtitle) => {
  const box = el(parent, "div", "panel");
  el(box, "h3", null, title);
  if (subtitle) el(box, "div", "muted", subtitle);
  return box;
};
const empty = (parent, text = "No data yet.") => el(parent, "div", "empty", text);
const bars = (parent, entries, limit = 10, labelValue = n => formatNumber(n)) => {
  const shown = entries.slice(0, limit);
  if (!shown.length) return empty(parent);
  const max = Math.max(...shown.map(entry => entry[1]), 1);
  for (const [name, value] of shown) {
    const row = el(parent, "div", "bar-row");
    const title = el(row, "div", "bar-name", name);
    title.title = name;
    const track = el(row, "div", "track");
    const fill = el(track, "div", "fill");
    fill.style.width = `${Math.max(0, value / max * 100)}%`;
    el(row, "div", "bar-value", labelValue(value));
  }
};
const bookLink = (parent, book) => {
  const link = el(parent, "a", "internal-link", book.file.name);
  link.setAttribute("data-href", book.file.path);
  link.setAttribute("href", book.file.path);
};
const table = (parent, headings, rows) => {
  if (!rows.length) return empty(parent);
  const wrap = el(parent, "div", "table-wrap");
  const table = el(wrap, "table");
  const head = el(el(table, "thead"), "tr");
  headings.forEach(heading => el(head, "th", null, heading));
  const body = el(table, "tbody");
  for (const row of rows) {
    const tr = el(body, "tr");
    for (const cell of row) {
      const td = el(tr, "td");
      if (cell && typeof cell === "object" && cell.book) bookLink(td, cell.book);
      else td.textContent = cell == null ? "—" : String(cell);
    }
  }
};

const hero = el(root, "div", "hero");
el(hero, "div", "eyebrow", "Your reading life");
el(hero, "h1", null, `${year} · Book dashboard`);
el(hero, "div", "muted", "A living view of the stories, pages and patterns in your library.");

const yearBooks = thisYear.map(item => item.book);
const pagesYear = sumPages(yearBooks);
const yearElapsed = Math.floor(now.diff(now.startOf("year"), "days").days) + 1;
const yearDays = now.endOf("year").ordinal;
const projected = Math.round(thisYear.length / yearElapsed * yearDays);
const snapshot = grid();
card(snapshot, formatNumber(thisYear.length), "Books finished", `in ${year}`);
card(snapshot, formatNumber(pagesYear), "Pages finished", `${withPages(yearBooks).length} books with page counts`);
card(snapshot, `${round(pagesYear / yearElapsed)} / day`, "Reading pace", "pages of finished books · calendar days this year");
card(snapshot, formatNumber(projected), "Year-end projection", "books · based on pace so far");

section("The rhythm of the year", "Completed books and their full page counts are credited to the finish month.");
const rhythm = panels();
const months = Array.from({length: 12}, (_, index) => {
  const entries = thisYear.filter(item => item.finish.month === index + 1);
  return {name: dv.luxon.DateTime.local(year, index + 1, 1).toFormat("MMM"), books: entries.length, pages: sumPages(entries.map(item => item.book))};
});
bars(panel(rhythm, "Books by month"), months.map(month => [month.name, month.books]), 12);
bars(panel(rhythm, "Pages by month"), months.map(month => [month.name, month.pages]), 12);

section("Your library, in numbers", "Finished books are counted by status; dated insights use their finish date.");
const allCards = grid();
const rated = finished.filter(book => number(book.rating) !== null);
const meanRating = rated.length ? rated.reduce((sum, book) => sum + book.rating, 0) / rated.length : null;
card(allCards, formatNumber(finished.length), "Books finished");
card(allCards, formatNumber(sumPages(finished)), "Pages finished", `${withPages(finished).length} books with page counts`);
card(allCards, formatNumber(countValues(finished, "author").length), "Distinct authors");
card(allCards, meanRating === null ? "—" : round(meanRating, 2), "Average rating", `${rated.length} rated books`);
card(allCards, formatNumber(backlog.length), "On your reading list");
card(allCards, formatNumber(sumPages(backlog)), "Pages on your reading list", `${withPages(backlog).length} books with page counts`);

const exploration = panels();
const genres = countValues(finished, "genre");
const authors = countValues(finished, "author");
bars(panel(exploration, "Genres you gravitate toward", "A book can count in more than one genre."), genres, 8);
bars(panel(exploration, "Most-read authors", "Co-authored books count for each author."), authors, 8);
const decades = new Map();
for (const book of finished) {
  const released = releaseYear(book.dateRelease);
  if (released !== null) {
    const decade = Math.floor(released / 10) * 10;
    decades.set(decade, (decades.get(decade) || 0) + 1);
  }
}
bars(panel(exploration, "Publication decades", "Based on release year, regardless of when you read the book."), [...decades].sort((a,b) => a[0] - b[0]).map(([decade, count]) => [`${decade}s`, count]), 30);
const ratings = new Map();
for (const book of rated) {
  const rating = String(book.rating);
  ratings.set(rating, (ratings.get(rating) || 0) + 1);
}
bars(panel(exploration, "Your ratings", "Exact rating values; unrated books are excluded."), [...ratings].sort((a,b) => Number(b[0]) - Number(a[0])), 30);

section("The reading record", "A closer look at finished books with the relevant metadata.");
const record = panels();
const recent = [...dated].sort((a, b) => b.finish.toMillis() - a.finish.toMillis()).slice(0, 8);
table(panel(record, "Recently finished"), ["Book", "Finished", "Rating"], recent.map(item => [
  {book: item.book}, item.finish.toFormat("dd LLL yyyy"), number(item.book.rating) ?? "—"
]));
const longest = withPages(finished).sort((a,b) => b.pages - a.pages).slice(0, 8);
table(panel(record, "Longest reads"), ["Book", "Pages"], longest.map(book => [{book}, formatNumber(book.pages)]));
const durations = dated.filter(item => item.start && item.finish.startOf("day") >= item.start.startOf("day"))
  .map(item => ({...item, days: Math.round(item.finish.startOf("day").diff(item.start.startOf("day"), "days").days)}));
const avgDays = durations.length ? durations.reduce((sum, item) => sum + item.days, 0) / durations.length : null;
const durationPanel = panel(record, "Time between start and finish", "Calendar days; same-day finishes count as 0 days.");
if (avgDays === null) empty(durationPanel, "Add start and finish dates to see reading durations.");
else {
  const facts = el(durationPanel, "div", "grid");
  card(facts, `${round(avgDays)} days`, "Average duration", `${durations.length} books with valid dates`);
  card(facts, formatNumber(durations.filter(item => item.days === 0).length), "Same-day finishes");
}

section("The long view", "A yearly record of finished books with a finish date. Missing page counts contribute no pages.");
const annual = new Map();
for (const item of dated) {
  const bucket = annual.get(item.finish.year) || {books: 0, pages: 0};
  bucket.books++;
  bucket.pages += number(item.book.pages) ?? 0;
  annual.set(item.finish.year, bucket);
}
const annualRows = [...annual].sort((a,b) => b[0] - a[0]);
const history = panels();
bars(panel(history, "Books finished by year"), [...annualRows].reverse().map(([yr, data]) => [String(yr), data.books]), 50);
table(panel(history, "Year by year"), ["Year", "Books", "Pages"], annualRows.map(([yr, data]) => [yr, data.books, formatNumber(data.pages)]));

const foot = el(root, "div", "muted", `Based on ${books.length} notes in Resources/Bases/Books · updated whenever Dataview refreshes.`);
foot.style.marginTop = "20px";
```

# Music

---
