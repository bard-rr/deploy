import { waitFor } from "./utils.js";

export const makePostgresService = async (ecs, fileSystemId, taskName) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "postgres:15",
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
            sourceVolume: "initPg",
            containerPath: "/docker-entrypoint-initdb.d",
          },
          {
            sourceVolume: "persistPg",
            containerPath: "/var/lib/postgresql/data",
          },
        ],
      },
    ],
    volumes: [
      {
        name: "initPg",
        efsVolumeConfiguration: {
          fileSystemId,
        },
      },
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
  });
  console.log("created the postgres task");

  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceName: "postgres-service",
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
  console.log("created the postgres service");
  console.log("waiting for the postgres service to start");
  await waitFor(
    ecs.describeServices.bind(ecs),
    {
      services: [serviceOutput.service.serviceArn],
      cluster: "bard-cluster",
    },
    "serviceActive",
    "ACTIVE"
  );
  console.log("postgres service started successfully!");
  console.log("waiting for task to be created");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "postgres-service",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("task created!");
  console.log("waiting for the postgres task to start.");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [taskList.taskArns[0]],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("postgres task running!");
};