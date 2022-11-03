import { waitFor } from "./utils.js";

export const makeSessionEnderService = async (ecs, fileSystemId, taskName) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "bardrr/session_ender",
        name: "session_ender",
        //TODO: need a better value for this
        memoryReservation: null,
        command: [],
        entryPoint: [],
        environment: [
          { name: "PGHOST", value: "postgres" },
          { name: "PGPORT", value: "5432" },
          { name: "PGUSER", value: "user" },
          { name: "PGPASSWORD", value: "password" },
          { name: "PGDATABASE", value: "bard" },
          { name: "CLICKHOUSE_HOST", value: "clickhouse" },
        ],
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
  console.log("created the session_ender task");

  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceName: "session_ender-service",
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
  console.log("created the session_ender-service");
  console.log("waiting for the session_ender-service to start");
  await waitFor(
    ecs.describeServices.bind(ecs),
    {
      services: [serviceOutput.service.serviceArn],
      cluster: "bard-cluster",
    },
    "serviceActive",
    "ACTIVE"
  );
  console.log("session_ender-service started successfully!");
  console.log("waiting for task to be created");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "session_ender-service",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("task created!");
  console.log("waiting for the session_ender task to start.");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [taskList.taskArns[0]],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("session_ender task running!");
};
