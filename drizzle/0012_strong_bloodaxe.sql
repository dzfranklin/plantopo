ALTER TABLE "recorded_track" ADD COLUMN "preview_large_src" "bytea";--> statement-breakpoint
ALTER TABLE "recorded_track" ADD COLUMN "preview_large_width" integer;--> statement-breakpoint
ALTER TABLE "recorded_track" ADD COLUMN "preview_large_height" integer;--> statement-breakpoint
ALTER TABLE "recorded_track" ADD COLUMN "preview_small_src" "bytea";--> statement-breakpoint
ALTER TABLE "recorded_track" ADD COLUMN "preview_small_width" integer;--> statement-breakpoint
ALTER TABLE "recorded_track" ADD COLUMN "preview_small_height" integer;