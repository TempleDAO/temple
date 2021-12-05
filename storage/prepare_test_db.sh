#!/usr/bin/env bash
echo "Preparing empty schema"
docker exec templedb psql -U postgres -f /tmp/storage/schema.sql
echo "Populating with dummy data"
docker exec templedb psql -U postgres -f /tmp/storage/insert_test_data.sql
echo "DONE"
