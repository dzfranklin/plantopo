ALTER TABLE "recorded_track_image" DROP CONSTRAINT "recorded_track_image_track_id_recorded_track_id_fk";
--> statement-breakpoint
ALTER TABLE "recorded_track_image" DROP CONSTRAINT "recorded_track_image_image_s3_key_image_s3_key_fk";
--> statement-breakpoint
ALTER TABLE "recorded_track_image" ADD CONSTRAINT "recorded_track_image_track_id_recorded_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."recorded_track"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recorded_track_image" ADD CONSTRAINT "recorded_track_image_image_s3_key_image_s3_key_fk" FOREIGN KEY ("image_s3_key") REFERENCES "public"."image"("s3_key") ON DELETE cascade ON UPDATE cascade;
