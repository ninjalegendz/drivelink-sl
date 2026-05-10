-- Trigger: when a support message is inserted, atomically update the
-- parent thread's last_message_at and flip the appropriate has_unread
-- flag (the one for the OTHER side of the conversation). Keeps the
-- listing-page sort + unread badge consistent without client-side
-- update races.

create or replace function bump_support_thread()
returns trigger language plpgsql as $$
begin
  update support_threads
  set
    last_message_at   = new.created_at,
    has_unread_admin  = case
      when new.sender_role = 'agency_owner' then true
      else has_unread_admin
    end,
    has_unread_agency = case
      when new.sender_role = 'admin' then true
      else has_unread_agency
    end
  where id = new.thread_id;
  return new;
end $$;

drop trigger if exists trg_support_message_bump on support_messages;
create trigger trg_support_message_bump
  after insert on support_messages
  for each row execute function bump_support_thread();
