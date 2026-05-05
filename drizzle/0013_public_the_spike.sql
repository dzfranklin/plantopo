CREATE TABLE "image" (
	"s3_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded" boolean DEFAULT false NOT NULL,
	"taken_at" text,
	"location" geometry(Point,4326),
	"exif" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "image_user_sha256" UNIQUE("user_id","sha256")
);
--> statement-breakpoint
CREATE TABLE "recorded_track_image" (
	"track_id" text NOT NULL,
	"image_s3_key" text NOT NULL,
	CONSTRAINT "recorded_track_image_pkey" PRIMARY KEY ("track_id","image_s3_key")
);
--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorded_track_image" ADD CONSTRAINT "recorded_track_image_track_id_recorded_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."recorded_track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorded_track_image" ADD CONSTRAINT "recorded_track_image_image_s3_key_image_s3_key_fk" FOREIGN KEY ("image_s3_key") REFERENCES "public"."image"("s3_key") ON DELETE no action ON UPDATE no action;