CREATE TABLE "track_import" (
	"user_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"raw_data" "bytea",
	"import_data" jsonb,
	"track_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "track_import_user_id_source_type_source_id_pk" PRIMARY KEY("user_id","source_type","source_id")
);
--> statement-breakpoint
ALTER TABLE "track_import" ADD CONSTRAINT "track_import_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_import" ADD CONSTRAINT "track_import_track_id_recorded_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."recorded_track"("id") ON DELETE set null ON UPDATE no action;