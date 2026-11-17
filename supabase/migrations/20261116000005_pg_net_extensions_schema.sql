-- pg_net's functions live in the net schema; keep the extension object out of public
drop extension if exists pg_net;
create extension pg_net with schema extensions;
