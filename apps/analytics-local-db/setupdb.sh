#!/usr/bin/env bash
echo "Preparing empty schema"
docker exec templedb psql -U postgres --dbname=temple -f /tmp/storage/setup/schema.sql
echo "Populating with dummy data"
docker exec templedb psql -U postgres --dbname=temple -f /tmp/storage/setup/insert_test_data.sql
echo "DONE"
