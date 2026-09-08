-- Phase 3 search: populate search_vector with language-neutral `simple` config
-- (English stemming would damage Arabic/mixed matching), plus pg_trgm for short/partial fallback.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.text_content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS messages_search_vector_trigger ON messages;
--> statement-breakpoint

CREATE TRIGGER messages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF text_content ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_search_vector_update();
--> statement-breakpoint

UPDATE messages
SET search_vector = to_tsvector('simple', coalesce(text_content, ''))
WHERE search_vector IS NULL OR true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS messages_text_content_trgm_idx
  ON messages USING gin (text_content gin_trgm_ops);
