// ข้อมูลตั้งต้นของห้องสมุด: 3 ตาราง (members, books, loans) เชื่อมกันด้วย foreign key
// หนังสือแต่ละเล่มในตาราง books คือหนังสือหนึ่งเล่มบนชั้น 3D (id ตรงกัน)

export const SEED_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  faculty    TEXT NOT NULL,
  year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 4)
);

CREATE TABLE books (
  id     INTEGER PRIMARY KEY,
  title  TEXT NOT NULL,
  author TEXT NOT NULL,
  genre  TEXT NOT NULL,
  year   INTEGER NOT NULL
);

CREATE TABLE loans (
  id        INTEGER PRIMARY KEY,
  book_id   INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  loan_date TEXT NOT NULL,
  due_date  TEXT NOT NULL,
  returned  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO members VALUES
  (1, 'Somchai',   'Engineering', 2),
  (2, 'Nattaya',   'Science',     3),
  (3, 'Pimchanok', 'Arts',        1),
  (4, 'Thanakorn', 'IT',          4),
  (5, 'Kanokwan',  'Business',    2),
  (6, 'Arthit',    'IT',          3),
  (7, 'Siriporn',  'Education',   1),
  (8, 'Worawit',   'Engineering', 4);

INSERT INTO books VALUES
  (1,  'Pride and Prejudice',            'Jane Austen',          'Fiction',    1813),
  (2,  'Nineteen Eighty-Four',           'George Orwell',        'Fiction',    1949),
  (3,  'The Little Prince',              'Antoine de Saint-Exupery', 'Fiction', 1943),
  (4,  'Frankenstein',                   'Mary Shelley',         'Fiction',    1818),
  (5,  'The Hobbit',                     'J. R. R. Tolkien',     'Fiction',    1937),
  (6,  'Dracula',                        'Bram Stoker',          'Fiction',    1897),
  (7,  'A Brief History of Time',        'Stephen Hawking',      'Science',    1988),
  (8,  'On the Origin of Species',       'Charles Darwin',       'Science',    1859),
  (9,  'Cosmos',                         'Carl Sagan',           'Science',    1980),
  (10, 'The Selfish Gene',               'Richard Dawkins',      'Science',    1976),
  (11, 'The Double Helix',               'James Watson',         'Science',    1968),
  (12, 'Sapiens',                        'Yuval Noah Harari',    'History',    2011),
  (13, 'Guns, Germs, and Steel',         'Jared Diamond',        'History',    1997),
  (14, 'The Silk Roads',                 'Peter Frankopan',      'History',    2015),
  (15, 'SPQR',                           'Mary Beard',           'History',    2015),
  (16, 'The Diary of a Young Girl',      'Anne Frank',           'History',    1947),
  (17, 'Clean Code',                     'Robert C. Martin',     'Technology', 2008),
  (18, 'The Pragmatic Programmer',       'Andrew Hunt',          'Technology', 1999),
  (19, 'Database System Concepts',       'Abraham Silberschatz', 'Technology', 1986),
  (20, 'Introduction to Algorithms',     'Thomas H. Cormen',     'Technology', 1990),
  (21, 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Technology', 2017),
  (22, 'Learning SQL',                   'Alan Beaulieu',        'Technology', 2005),
  (23, 'The Story of Art',               'E. H. Gombrich',       'Art',        1950),
  (24, 'Ways of Seeing',                 'John Berger',          'Art',        1972),
  (25, 'Steal Like an Artist',           'Austin Kleon',         'Art',        2012),
  (26, 'The Design of Everyday Things',  'Don Norman',           'Art',        1988);

INSERT INTO loans VALUES
  (1,  2,  1, '2026-10-20', '2026-11-03', 1),
  (2,  19, 4, '2026-10-28', '2026-11-11', 0),
  (3,  21, 6, '2026-11-01', '2026-11-15', 0),
  (4,  7,  2, '2026-10-25', '2026-11-08', 0),
  (5,  12, 3, '2026-10-15', '2026-10-29', 0),
  (6,  24, 5, '2026-11-02', '2026-11-16', 0),
  (7,  17, 4, '2026-10-10', '2026-10-24', 1),
  (8,  5,  7, '2026-11-03', '2026-11-17', 0),
  (9,  21, 8, '2026-10-05', '2026-10-19', 1),
  (10, 9,  2, '2026-11-04', '2026-11-18', 0),
  (11, 16, 1, '2026-10-30', '2026-11-13', 0),
  (12, 3,  3, '2026-10-18', '2026-11-01', 0),
  (13, 22, 6, '2026-11-05', '2026-11-19', 0),
  (14, 11, 5, '2026-10-12', '2026-10-26', 1);
`
