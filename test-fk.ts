import Database from 'better-sqlite3';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE parent (id INTEGER PRIMARY KEY);
  CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id));
  INSERT INTO parent (id) VALUES (1);
  INSERT INTO child (id, parent_id) VALUES (1, 1);
`);

try {
  db.prepare('DELETE FROM parent WHERE id = 1').run();
  console.log('Success: Foreign keys are OFF by default');
} catch (e) {
  console.log('Error: Foreign keys are ON by default', e.message);
}
