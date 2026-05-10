-- Track the Didit session id on the profile so the admin "Sync from
-- Didit" button can fetch the latest status by session id (more
-- reliable than relying on the webhook, which can be misconfigured
-- or miss manual-decision events).

alter table profiles add column if not exists didit_session_id text;
