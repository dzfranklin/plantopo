ALTER TABLE "recorded_track_image" RENAME TO "track_image";--> statement-breakpoint
ALTER TABLE "recorded_track" RENAME TO "track";--> statement-breakpoint
ALTER TABLE "track_image" DROP CONSTRAINT "recorded_track_image_track_id_recorded_track_id_fk";
--> statement-breakpoint
ALTER TABLE "track_image" DROP CONSTRAINT "recorded_track_image_image_s3_key_image_s3_key_fk";
--> statement-breakpoint
ALTER TABLE "track" DROP CONSTRAINT "recorded_track_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "track_import" DROP CONSTRAINT "track_import_track_id_recorded_track_id_fk";
--> statement-breakpoint
DROP INDEX "recorded_track_source_idx";--> statement-breakpoint
ALTER TABLE "track_image" DROP CONSTRAINT "recorded_track_image_pkey";--> statement-breakpoint
ALTER TABLE "track_image" ADD CONSTRAINT "track_image_pkey" PRIMARY KEY("track_id","image_s3_key");--> statement-breakpoint
ALTER TABLE "track_image" ADD CONSTRAINT "track_image_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_image" ADD CONSTRAINT "track_image_image_s3_key_image_s3_key_fk" FOREIGN KEY ("image_s3_key") REFERENCES "public"."image"("s3_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track" ADD CONSTRAINT "track_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_import" ADD CONSTRAINT "track_import_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "track_source_idx" ON "track" USING btree ("user_id","source_type","source_id") WHERE "track"."source_type" IS NOT NULL;