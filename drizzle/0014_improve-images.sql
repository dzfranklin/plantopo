ALTER TABLE "image" ADD COLUMN "filename" text;--> statement-breakpoint
UPDATE "image" SET "filename" = "s3_key";--> statement-breakpoint
ALTER TABLE "image" ALTER COLUMN "filename" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recorded_track_image" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
