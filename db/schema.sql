-- LLM Wiki — PostgreSQL index schema
--
-- IMPORTANT: Postgres here is a QUERYABLE INDEX/CACHE of the markdown wiki,
-- not a replacement for it. wiki/pages/*.md remains the source of truth.
-- This database is rebuilt at any time by re-running the sync script
-- (mcp-server/sync.js) against the markdown files, so it's always safe to
-- drop and recreate it.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS pages (
    slug        TEXT PRIMARY KEY,           -- filename without .md, e.g. "andrej-karpathy"
    title       TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('concept', 'person', 'tool', 'source', 'organization')),
    tier        SMALLINT NOT NULL DEFAULT 1 CHECK (tier IN (1, 2, 3)),
    tags        TEXT[] NOT NULL DEFAULT '{}',
    created     DATE,
    updated     DATE,
    summary     TEXT,                       -- first paragraph after the H1
    body        TEXT NOT NULL,               -- full markdown content
    file_path   TEXT NOT NULL,               -- path relative to repo root
    search_vec  TSVECTOR,                    -- generated full-text search vector
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pages' AND column_name = 'tier'
    ) THEN
        ALTER TABLE pages ADD COLUMN tier SMALLINT NOT NULL DEFAULT 1;
        ALTER TABLE pages ADD CONSTRAINT pages_tier_check CHECK (tier IN (1, 2, 3));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS page_links (
    from_slug   TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
    to_slug     TEXT NOT NULL,               -- may point to a slug not yet ingested
    to_title    TEXT NOT NULL,               -- the raw [[Wikilink]] text
    PRIMARY KEY (from_slug, to_slug)
);

CREATE TABLE IF NOT EXISTS page_sources (
    slug        TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
    raw_path    TEXT NOT NULL,               -- e.g. raw/articles/foo.md
    note        TEXT,                        -- what the page drew from it
    PRIMARY KEY (slug, raw_path)
);

CREATE TABLE IF NOT EXISTS wiki_log (
    id          SERIAL PRIMARY KEY,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_entry   TEXT NOT NULL                -- verbatim line from wiki/log.md
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_pages_search ON pages USING GIN (search_vec);
-- Fuzzy title search (handles typos / partial matches)
CREATE INDEX IF NOT EXISTS idx_pages_title_trgm ON pages USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pages_tags ON pages USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_pages_type ON pages (type);
CREATE INDEX IF NOT EXISTS idx_links_to ON page_links (to_slug);

-- Keep search_vec current automatically on insert/update
CREATE OR REPLACE FUNCTION pages_search_vec_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vec :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.body, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pages_search_vec ON pages;
CREATE TRIGGER trg_pages_search_vec
    BEFORE INSERT OR UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION pages_search_vec_update();

-- Handy view: pages with a broken outgoing link (target slug doesn't exist)
CREATE OR REPLACE VIEW broken_links AS
SELECT pl.from_slug, pl.to_title
FROM page_links pl
LEFT JOIN pages p ON p.slug = pl.to_slug
WHERE p.slug IS NULL;

-- Handy view: one-directional links (A -> B but no B -> A)
CREATE OR REPLACE VIEW one_directional_links AS
SELECT pl.from_slug, pl.to_slug
FROM page_links pl
WHERE NOT EXISTS (
    SELECT 1 FROM page_links back_link
    WHERE back_link.from_slug = pl.to_slug
      AND back_link.to_slug = pl.from_slug
);
