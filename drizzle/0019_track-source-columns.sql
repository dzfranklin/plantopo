ALTER TABLE "recorded_track" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "recorded_track" ADD COLUMN "source_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "recorded_track_source_idx" ON "recorded_track" USING btree ("user_id","source_type","source_id") WHERE "recorded_track"."source_type" IS NOT NULL;