-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_email VARCHAR NOT NULL,
    firebase_uid VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_email)
);

CREATE INDEX IF NOT EXISTS ix_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS ix_team_members_user_email ON team_members(user_email);
CREATE INDEX IF NOT EXISTS ix_team_members_firebase_uid ON team_members(firebase_uid);

-- Create team_invites table
CREATE TABLE IF NOT EXISTS team_invites (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    invite_code VARCHAR UNIQUE NOT NULL,
    created_by VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    uses INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_team_invites_code ON team_invites(invite_code);
CREATE INDEX IF NOT EXISTS ix_team_invites_team_id ON team_invites(team_id);

-- Migrate existing teams to team_members
INSERT INTO team_members (team_id, user_email, firebase_uid, role)
SELECT id, email, firebase_uid, 'owner'
FROM teams
WHERE email IS NOT NULL
ON CONFLICT (team_id, user_email) DO NOTHING;
