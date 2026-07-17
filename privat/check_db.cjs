const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE || process.env.HOME, '.nebula-presence-app', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all('SELECT count(*) as count FROM members', [], (err, rows) => {
    if (err) console.error(err);
    else console.log('Total members:', rows[0].count);
    
    db.all('SELECT d.name as kelas, count(m.id) as count FROM members m LEFT JOIN divisions d ON m.division_id = d.id GROUP BY d.name', [], (err, rows2) => {
        if (err) console.error(err);
        else console.log('Members by division:', rows2);
        db.close();
    });
});
