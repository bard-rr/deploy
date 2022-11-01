CREATE DATABASE IF NOT EXISTS eventDb;

CREATE TABLE IF NOT EXISTS eventDb.conversionEvents
  (
    sessionId String,
    eventType String,
    textContent Nullable(String),
    customEventType Nullable(String),
    timestamp UInt64
  )
ENGINE = MergeTree()
PRIMARY KEY (sessionId, eventType);

CREATE TABLE IF NOT EXISTS eventDb.eventTable
  (sessionId String, event String)
ENGINE = MergeTree()
PRIMARY KEY (sessionId);

CREATE TABLE IF NOT EXISTS eventDb.eventQueue
  (sessionId String, event String)
ENGINE = RabbitMQ SETTINGS
  rabbitmq_address = 'amqp://rabbitmq:5672',
  rabbitmq_exchange_name = 'test-exchange',
  rabbitmq_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW IF NOT EXISTS eventDb.consumer TO eventDb.eventTable
AS SELECT * FROM eventDb.eventQueue;

CREATE TABLE IF NOT EXISTS eventDb.sessionTable
  (
    sessionId String,
    startTime UInt64,
    endTime UInt64,
    lengthMs UInt64,
    date Date,
    originHost String,
    errorCount UInt64
  )
ENGINE = MergeTree()
PRIMARY KEY (sessionId);