CREATE TABLE pt.access_requests (
    internal_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    external_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    implicitly_obsoleted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    requesting_user_id UUID NOT NULL REFERENCES pt.users(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES pt.users(id) ON DELETE CASCADE,
    map_internal_id BIGINT NOT NULL REFERENCES pt.maps(internal_id) ON DELETE CASCADE,
    requested_role pt.my_role NOT NULL,
    message TEXT NOT NULL
)
