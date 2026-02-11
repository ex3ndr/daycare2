-- Add search vector for message text search.
ALTER TABLE "Message"
  ADD COLUMN "search_vector" tsvector;

UPDATE "Message"
SET "search_vector" = to_tsvector('english', coalesce("text", ''));

CREATE INDEX "Message_search_vector_idx"
ON "Message" USING GIN ("search_vector");

CREATE OR REPLACE FUNCTION "message_search_vector_update"()
RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('english', coalesce(NEW."text", ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Message_search_vector_update_trigger"
BEFORE INSERT OR UPDATE OF "text"
ON "Message"
FOR EACH ROW
EXECUTE FUNCTION "message_search_vector_update"();

-- Add chat name/topic full-text index.
CREATE INDEX "Chat_name_topic_search_idx"
ON "Chat" USING GIN (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("topic", '')));
