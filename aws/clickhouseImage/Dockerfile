FROM clickhouse/clickhouse-server

COPY bard.sql /docker-entrypoint-initdb.d
COPY config.xml /etc/clickhouse-server/config.d/config.xml