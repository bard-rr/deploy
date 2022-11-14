import { getOrCreateDiscoveryService, waitFor } from "./utils.js";
import dotenv from "dotenv";
dotenv.config();

export const makePostgresService = async (
  ecs,
  fileSystemId,
  taskName,
  serviceDiscoveryClient,
  namespaceId
) => {
  console.log("Starting work on Postgres");
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        // image: "postgres:15",
        // image: "bardrr/postgres",
        image: "bardrr/postgres:test",
        name: "postgres",
        //TODO: need a better value for this
        memoryReservation: null,
        command: [],
        entryPoint: [],
        portMappings: [
          {
            containerPort: 5432,
            hostPort: 5432,
            protocol: "tcp",
          },
        ],
        environment: [
          { name: "POSTGRES_USER", value: "user" },
          { name: "POSTGRES_PASSWORD", value: "password" },
        ],
        mountPoints: [
          {
            sourceVolume: "persistPg",
            containerPath: "/var/lib/postgresql/data",
          },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          secretOptions: null,
          options: {
            // totoggle
            // "awslogs-create-group": "true",
            "awslogs-group": "/ecs/test_logged_task",
            "awslogs-region": process.env.AWS_REGION_NAME,
            "awslogs-stream-prefix": "ecs",
          },
        },
      },
    ],
    volumes: [
      {
        name: "persistPg",
        efsVolumeConfiguration: {
          fileSystemId,
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
    "postgres"
  );

  console.log("Postgres discovery service Arn obtained", discoveryServiceArn);
  console.log("Creating the Postgres ECS Service.");
  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceRegistries: [
      {
        registryArn: discoveryServiceArn,
      },
    ],
    serviceName: "postgres",
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
  console.log("Waiting for the Postgres service to start.");
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
  console.log("Waiting for the Postgres task to be created.");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "postgres",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("Done.");
  console.log("Waiting for the Postgres task to start.");
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
