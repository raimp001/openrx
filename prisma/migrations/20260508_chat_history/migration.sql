-- Chat history persistence (replaces the os.tmpdir() JSON file store)

CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id"         TEXT PRIMARY KEY,
  "ownerKey"   TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "pinned"     BOOLEAN NOT NULL DEFAULT FALSE,
  "archived"   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"  TIMESTAMP(3) NOT NULL,
  "updatedAt"  TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_conversations_owner_archived_updated_idx"
  ON "chat_conversations" ("ownerKey", "archived", "updatedAt");

CREATE INDEX IF NOT EXISTS "chat_conversations_owner_pinned_updated_idx"
  ON "chat_conversations" ("ownerKey", "pinned", "updatedAt");

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"             TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "role"           TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "agentId"        TEXT,
  "collaborators"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "routingInfo"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_created_idx"
  ON "chat_messages" ("conversationId", "createdAt");
