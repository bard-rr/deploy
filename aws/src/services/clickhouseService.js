import { waitFor } from "./utils.js";

export const makeClickhouseService = async (ecs, fileSystemId, taskName) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "clickhouse/clickhouse-server",
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
            sourceVolume: "initCh",
            containerPath: "/docker-entrypoint-initdb.d",
          },
          {
            sourceVolume: "persistCh",
            containerPath: "/bitnami/clickhouse",
          },
        ],
        //environment: [{ name: "ALLOW_EMPTY_PASSWORD", value: "yes" }],
      },
    ],
    volumes: [
      {
        name: "initCh",
        efsVolumeConfiguration: {
          fileSystemId,
        },
      },
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
  });
  console.log("created the clickhouse task");

  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceName: "clickhouse-service",
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
        subnets: ["subnet-08e97a8a4d3098617"],
        securityGroups: ["sg-0824cc4158587a789"],
        assignPublicIp: "ENABLED",
      },
    },
  });
  console.log("created the clickhouse service");
  console.log("waiting for the clickhouse service to start");
  await waitFor(
    ecs.describeServices.bind(ecs),
    {
      services: [serviceOutput.service.serviceArn],
      cluster: "bard-cluster",
    },
    "serviceActive",
    "ACTIVE"
  );
  console.log("clickhouse service started successfully!");
  console.log("waiting for task to be created");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "clickhouse-service",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("task created!");
  console.log("waiting for the clickhouse task to start.");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [taskList.taskArns[0]],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("clickhouse task running!");
};
