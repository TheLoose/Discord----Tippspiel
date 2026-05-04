const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function initDB() {
  console.log('📦 Initialising database...');

  await query(`
    CREATE TABLE IF NOT EXISTS leagues (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      emoji      VARCHAR(50),
      channel_id VARCHAR(100),
      active     BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS matchdays (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      league_id  INT NOT NULL,
      number     INT NOT NULL,
      label      VARCHAR(100),
      channel_id VARCHAR(100),
      status     ENUM('open','closed','evaluated') DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_matchday (league_id, number),
      FOREIGN KEY (league_id) REFERENCES leagues(id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teams (
      team_id    INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      league_id  INT NOT NULL,
      emoji      VARCHAR(100) NOT NULL,
      active     BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_team (name, league_id),
      FOREIGN KEY (league_id) REFERENCES leagues(id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS matches (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      league_id          INT NOT NULL,
      matchday_id        INT DEFAULT NULL,
      team_a_id          INT NOT NULL,
      team_b_id          INT NOT NULL,
      match_date         TIMESTAMP NULL DEFAULT NULL,
      discord_message_id VARCHAR(100),
      discord_channel_id VARCHAR(100),
      status             ENUM('scheduled','open','closed','evaluated') DEFAULT 'scheduled',
      winning_team       ENUM('a','b') DEFAULT NULL,
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (league_id)   REFERENCES leagues(id),
      FOREIGN KEY (matchday_id) REFERENCES matchdays(id),
      FOREIGN KEY (team_a_id)   REFERENCES teams(team_id),
      FOREIGN KEY (team_b_id)   REFERENCES teams(team_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS votes (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      match_id   INT NOT NULL,
      user_id    VARCHAR(100) NOT NULL,
      username   VARCHAR(100) NOT NULL,
      team       ENUM('a','b') NOT NULL,
      voted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_vote (match_id, user_id),
      FOREIGN KEY (match_id) REFERENCES matches(id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS points (
      user_id     VARCHAR(100) NOT NULL,
      league_id   INT NOT NULL,
      username    VARCHAR(100) NOT NULL,
      total       INT DEFAULT 0,
      correct     INT DEFAULT 0,
      total_votes INT DEFAULT 0,
      PRIMARY KEY (user_id, league_id),
      FOREIGN KEY (league_id) REFERENCES leagues(id)
    )
  `);

  console.log('✅ Database ready.');
}

module.exports = { query, initDB };
