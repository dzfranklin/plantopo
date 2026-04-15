CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE "recorded_track" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"path" geometry(LineString,4326),
	"point_timestamps" double precision[] NOT NULL,
	"point_gps_elevation" double precision[],
	"point_horizontal_accuracy" double precision[],
	"point_vertical_accuracy" double precision[],
	"point_speed" double precision[],
	"point_speed_accuracy" double precision[],
	"point_bearing" double precision[],
	"point_bearing_accuracy" double precision[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recorded_track" ADD CONSTRAINT "recorded_track_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
