CREATE TABLE "native_session_init_token" (
	"token" text PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
