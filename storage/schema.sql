CREATE TABLE discord_users (
 user_id varchar(255),
 user_name text,
 joined_at timestamp,
 premium_since timestamp,
 primary key(user_id)
);

CREATE TABLE discord_user_roles (
 user_id varchar(255),
 role_name text not null,
 primary key(user_id, role_name)
);

CREATE TABLE discord_channels (
 channel_id varchar(255),
 channel_name text,
 primary key(channel_id)
);

CREATE TABLE discord_user_messages (
 message_id varchar(255),
 user_id varchar(255),
 channel_id varchar(255),
 created_at timestamp,
 reply_to varchar(255),
 content_size int,
 reactions_count int,
 primary key(message_id)
);
