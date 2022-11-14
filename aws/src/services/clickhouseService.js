import { waitFor, getOrCreateDiscoveryService } from "./utils.js";
import dotenv from "dotenv";
dotenv.config();

export const makeClickhouseService = async (
  ecs,
  fileSystemId,
  taskName,
  serviceDiscoveryClient,
  namespaceId
) => {
  console.log("Starting work on Clickhouse.");
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "bardrr/clickhouse",
        name: "clickhouse",
        //TODO: need a better value for this
        memoryReservation: null,
        command: [],
        entryPoint: [],
        portMappings: [
          {
            containerPort: 8123,
            hostPort: 8123,
            protocol: "tcp",
          },
        ],
        mountPoints: [
          {
            sourceVolume: "persistCh",
            containerPath: "/var/lib/clickhouse/",
          },
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
    volumes: [
      {
        name: "persistCh",
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
    "clickhouse"
  );

  console.log("Clickhouse discovery service Arn obtained", discoveryServiceArn);
  console.log("Creating the Clickhouse ECS Service.");
  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceRegistries: [
      {
        registryArn: discoveryServiceArn,
      },
    ],
    serviceName: "clickhouse",
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
  console.log("Waiting for the Clickhouse service to start.");
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
  console.log("Waiting for the Clickhouse task to be created.");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "clickhouse",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("Done.");
  console.log("Waiting for the Clickhouse task to start.");
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
