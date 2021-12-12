
COPY discord_users FROM '/tmp/storage/setup/initial-data/discord_users.csv' DELIMITER ',' CSV HEADER;
COPY discord_channels FROM '/tmp/storage/setup/initial-data/discord_channels.csv' DELIMITER ',' CSV HEADER;
COPY discord_user_messages FROM '/tmp/storage/setup/initial-data/discord_user_messages.csv' DELIMITER ',' CSV HEADER;
COPY discord_user_roles FROM '/tmp/storage/setup/initial-data/discord_user_roles.csv' DELIMITER ',' CSV HEADER;
