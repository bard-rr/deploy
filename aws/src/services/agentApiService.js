import { waitFor } from "./utils.js";

export const makeAgentApiService = async (ecs, fileSystemId, taskName) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "bardrr/agent-api:latest",
        name: "agent-api",
        //TODO: need a better value for this
        memoryReservation: null,
        command: [],
        entryPoint: [],
        portMappings: [
          {
            containerPort: 3001,
            hostPort: 3001,
            protocol: "tcp",
          },
        ],
        environment: [
          { name: "PGHOST", value: "postgres" },
          { name: "PGPORT", value: "5432" },
          { name: "PGUSER", value: "user" },
          { name: "PGPASSWORD", value: "password" },
          { name: "PGDATABASE", value: "bard" },
          { name: "RABBITMQ_HOST", value: "rabbitmq" },
          { name: "CLICKHOUSE_HOST", value: "clickhouse" },
          {
            name: "ACCESS_TOKEN_SECRET",
            value:
              "'26f08d4369fecdcef0d05efd2732dab2dad7aa2357df5af39b180052fa151c9140d5f2e6cb684bf5c21cee7d448074a3b7606cad191ebb977af4d4221c71cd75d6'",
          },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          secretOptions: null,
          options: {
            "awslogs-group": "/ecs/test_logged_task",
            "awslogs-region": "us-east-1",
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
  console.log("created the agent-api task");

  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceName: "agent-api-service",
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
  console.log("created the agent-api-service");
  console.log("waiting for the agent-api-service to start");
  await waitFor(
    ecs.describeServices.bind(ecs),
    {
      services: [serviceOutput.service.serviceArn],
      cluster: "bard-cluster",
    },
    "serviceActive",
    "ACTIVE"
  );
  console.log("agent-api-service started successfully!");
  console.log("waiting for task to be created");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "agent-api-service",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("task created!");
  console.log("waiting for the agent-api task to start.");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [taskList.taskArns[0]],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("agent-api task running!");
};
