// Nightly consistent snapshot of the live DB via SQLite backup API (safe under WAL, unlike cp),
// keeping the newest 7. Installed by cron; log at ~/backups/backup.log.
const Database = require("/home/deploy/mfmmoserver/node_modules/better-sqlite3");
const fs = require("fs");
const path = require("path");
const DIR = "/home/deploy/backups";
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const dest = path.join(DIR, `data-${stamp}.sqlite`);
const db = new Database("/home/deploy/mfmmoserver/data.sqlite", { readonly: true });
db.backup(dest).then(() => {
  const size = fs.statSync(dest).size;
  const checkDb = new Database(dest, { readonly: true });
  const check = checkDb.prepare("pragma integrity_check").get();
  checkDb.close();
  // A readonly close does not remove WAL sidecars -- delete them so a snapshot is one file.
  [dest + "-shm", dest + "-wal"].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  console.log(`${new Date().toISOString()} backup ok ${dest} ${size}B integrity=${JSON.stringify(check)}`);
  const old = fs.readdirSync(DIR).filter(f => /^data-.*\.sqlite$/.test(f)).sort().reverse().slice(7);
  old.forEach(f => { fs.unlinkSync(path.join(DIR, f)); console.log("pruned", f); });
  process.exit(0);
}).catch(e => { console.error(`${new Date().toISOString()} backup FAILED`, e); process.exit(1); });
