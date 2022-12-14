import { getOrCreateDiscoveryService, waitFor } from "./utils.js";
import dotenv from "dotenv";
dotenv.config();

export const makeSessionEnderService = async (
  ecs,
  taskName,
  serviceDiscoveryClient,
  namespaceId
) => {
  console.log("Starting work for session_ender.");
  await ecs.registerTaskDefinition({
    family: taskName,
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "bardrr/session_ender:latest",
        name: "session_ender",
        memoryReservation: null,
        command: [],
        entryPoint: [],
        environment: [
          { name: "PGHOST", value: "postgres.bard" },
          { name: "PGPORT", value: "5432" },
          { name: "PGUSER", value: "user" },
          { name: "PGPASSWORD", value: "password" },
          { name: "PGDATABASE", value: "bard" },
          { name: "CLICKHOUSE_HOST", value: "clickhouse.bard" },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          secretOptions: null,
          options: {
            "awslogs-group": "/ecs/test_logged_task",
            "awslogs-region": process.env.AWS_REGION_NAME,
            "awslogs-stream-prefix": "ecs",
          },
        },
      },
    ],
    //these next pieces are all required by fargate
    networkMode: "awsvpc",
    runtimePlatform: {
      operatingSystemFamily: "LINUX",
    },
    cpu: "256",
    memory: "1024",
    requiresAttributes: [
      {
        targetId: null,
        targetType: null,
        value: null,
        name: "com.amazonaws.ecs.capability.logging-driver.awslogs",
      },
      {
        targetId: null,
        targetType: null,
        value: null,
        name: "ecs.capability.execution-role-awslogs",
      },
    ],
  });

  let discoveryServiceArn = await getOrCreateDiscoveryService(
    serviceDiscoveryClient,
    namespaceId,
    "session_ender"
  );

  console.log("session_ender discovery service Arn obtained.");
  console.log("Creating the session_ender ECS Service.");
  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceRegistries: [
      {
        registryArn: discoveryServiceArn,
      },
    ],
    serviceName: "session_ender",
    cluster: "bard-cluster",
    desiredCount: 1,
    launchType: "FARGATE",
    schedulingStrategy: "REPLICA",
    deploymentConfiguration: {
      maximumPercent: 200,
      minimumHealthyPercent: 100,
      deploymentCircuitBreaker: {
        enable: false,
      },
    },
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [process.env.AWS_SUBNET_ID],
        securityGroups: [process.env.AWS_SECURITY_GROUP_ID],
        assignPublicIp: "ENABLED",
      },
    },
  });
  console.log("Done.");
  console.log("Waiting for the session_ender service to start.");
  await waitFor(
    ecs.describeServices.bind(ecs),
    {
      services: [serviceOutput.service.serviceArn],
      cluster: "bard-cluster",
    },
    "serviceActive",
    "ACTIVE"
  );
  console.log("Done.");
  console.log("Waiting for the session_ender task to be created.");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "session_ender",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("Done.");
  console.log("Waiting for the session_ender task to start.");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [taskList.taskArns[0]],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("Done.");
};
