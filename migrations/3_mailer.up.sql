CREATE TABLE mailer_jobs (
  id SERIAL PRIMARY KEY,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,

  idempotency_key TEXT NOT NULL,
  email_to TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_text_body TEXT NOT NULL,
)

CREATE UNIQUE INDEX mailer_jobs_unique_key_idx ON mailer_jobs (unique_key);
