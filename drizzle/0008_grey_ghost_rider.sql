ALTER TABLE "user" ADD COLUMN "tile_key" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "edu_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user" SET "tile_key" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE "tile_key" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "tile_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_tile_key_idx" ON "user" USING btree ("tile_key");