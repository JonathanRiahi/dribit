-- Dribit social server (0.31): groups, leaderboards and refer-a-friend. Cloudflare D1 (SQLite).
-- Safe to run again: every statement is IF NOT EXISTS. The deploy action runs it before each deploy.
-- Only a nickname the person chose, points, streak and lesson count. No name, phone, email or exact IP.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- random public id (10 letters), shown to nobody
  secret TEXT NOT NULL,             -- SHA-256 of the device's secret (the secret itself stays on the phone)
  nick TEXT,                        -- the nickname the person chose (null until they join or open a group)
  ref TEXT NOT NULL UNIQUE,         -- the personal invite code in ?r=
  invited_by TEXT,                  -- users.id of the person whose link they came from
  counted INTEGER NOT NULL DEFAULT 0, -- 1 once they finished a lesson and counted as a friend for invited_by
  friends INTEGER NOT NULL DEFAULT 0, -- friends who came from my link and finished a lesson
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  lessons INTEGER NOT NULL DEFAULT 0,
  week TEXT,                        -- the week (its Sunday, Israel time) week_xp belongs to
  week_xp INTEGER NOT NULL DEFAULT 0,
  team INTEGER NOT NULL DEFAULT 0,  -- a team device (Jonathan, Nehorai): left out of /v1/stats
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_invited_by ON users(invited_by);

CREATE TABLE IF NOT EXISTS groups (
  code TEXT PRIMARY KEY,            -- 6 letters, in the invite link ?g=
  name TEXT NOT NULL,
  owner TEXT NOT NULL,              -- users.id of the creator (can remove members)
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS groups_owner ON groups(owner);

CREATE TABLE IF NOT EXISTS members (
  code TEXT NOT NULL,
  user TEXT NOT NULL,
  joined INTEGER NOT NULL,
  PRIMARY KEY (code, user)
);
CREATE INDEX IF NOT EXISTS members_user ON members(user);

-- points of past weeks, kept for "last week's winner" (a user row holds only the current week)
CREATE TABLE IF NOT EXISTS weeks (
  user TEXT NOT NULL,
  week TEXT NOT NULL,
  xp INTEGER NOT NULL,
  PRIMARY KEY (user, week)
);

-- abuse limits: k is a short hash (never the IP itself), removed after a day
CREATE TABLE IF NOT EXISTS limits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  until INTEGER NOT NULL
);
