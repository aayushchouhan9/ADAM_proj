-- Enable replication for tasks and activity_log to allow Supabase Realtime subscriptions
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table activity_log;
