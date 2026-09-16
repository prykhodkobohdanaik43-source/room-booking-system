CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'OFFICE_ADMIN', 'IT');
CREATE TYPE booking_status AS ENUM ('ACTIVE', 'CONFIRMED', 'CANCELLED', 'AUTO_CANCELLED');

CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name             TEXT NOT NULL,
    email                 TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash         TEXT,
    role                  user_role NOT NULL,
    is_blocked            BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL,
    capacity         INTEGER NOT NULL CHECK (capacity > 0),
    floor            INTEGER NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_from DATE,
    deactivated_to   DATE,
    CHECK (deactivated_from IS NULL OR deactivated_to IS NULL OR deactivated_from <= deactivated_to)
);

CREATE UNIQUE INDEX rooms_name_unique ON rooms (lower(name));

CREATE TABLE bookings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id            UUID NOT NULL REFERENCES rooms (id),
    author_id          UUID NOT NULL REFERENCES users (id),
    start_time         TIMESTAMPTZ NOT NULL,
    end_time           TIMESTAMPTZ NOT NULL,
    participants_count INTEGER NOT NULL CHECK (participants_count >= 1),
    status             booking_status NOT NULL DEFAULT 'ACTIVE',
    cancel_reason      TEXT,
    cancelled_by       UUID REFERENCES users (id),
    reminder_sent_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time),
    -- ФВ-18: дві броні однієї кімнати, що займають слот, не можуть перетинатися в часі
    CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status IN ('ACTIVE', 'CONFIRMED'))
);

CREATE INDEX bookings_status_start_idx ON bookings (status, start_time);

CREATE TABLE event_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id    UUID REFERENCES users (id),
    action_type TEXT NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX event_log_occurred_at_idx ON event_log (occurred_at DESC);
