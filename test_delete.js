const Database = require('better-sqlite3');
const { join } = require('path');
const os = require('os');

const dbPath = join(os.homedir(), 'Library', 'Application Support', 'money', 'database', 'money.sqlite');
console.log('dbPath:', dbPath);

try {
  const db = new Database(dbPath, { readonly: false });
  const members = db.prepare('SELECT id FROM members LIMIT 1').all();
  console.log('members:', members);

  if (members.length > 0) {
    const id = members[0].id;
    console.log('Trying to delete member:', id);
    try {
      db.prepare('DELETE FROM members WHERE id = ?').run(id);
      console.log('Deleted member successfully!');
      db.prepare('DELETE FROM membership_fee_records WHERE member_id = ?').run(id);
    } catch (err) {
      console.error('Error deleting member:', err);
    }
  } else {
    console.log('No members found. Inserting dummy member.');
    db.prepare('INSERT INTO members (id, name, phone, email, join_date, status, auto_frozen) VALUES (?, ?, ?, ?, ?, ?, ?)').run('dummy_id', 'dummy', '123', '', '2023-01-01', 'active', 0);
    db.prepare('INSERT INTO membership_fee_records (id, member_id, cycle, amount, payment_date, expiry_date, status, sync_status, retry_count, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('dummy_fee', 'dummy_id', 'monthly', 100, '2023-01-01', '2023-02-01', 'paid', 'synced', 0, 1);
    console.log('Inserted dummy. Run again.');
  }
} catch (err) {
  console.error('Cannot open db:', err);
}
