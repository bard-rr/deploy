import { waitFor, getOrCreateDiscoveryService } from "./utils.js";
import dotenv from "dotenv";
dotenv.config();

export const makeAgentApiService = async (
  ecs,
  taskName,
  serviceDiscoveryClient,
  namespaceId
) => {
  console.log("Starting work on the agent-api");
  await ecs.registerTaskDefinition({
    family: taskName,
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "bardrr/agent-api:latest",
        name: "agent-api",
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
          { name: "PGHOST", value: "postgres.bard" },
          { name: "PGPORT", value: "5432" },
          { name: "PGUSER", value: "user" },
          { name: "PGPASSWORD", value: "password" },
          { name: "PGDATABASE", value: "bard" },
          { name: "RABBITMQ_HOST", value: "rabbitmq.bard" },
          { name: "CLICKHOUSE_HOST", value: "clickhouse.bard" },
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
    "agent-api"
  );

  console.log("Agent-api discovery service Arn obtained", discoveryServiceArn);

  console.log("Creating the agent-api ECS Service");
  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
    serviceRegistries: [
      {
        registryArn: discoveryServiceArn,
      },
    ],
    serviceName: "agent-api",
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
  console.log("Waiting for the agent-api-service to start");
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
  console.log("waiting for the agent-api task to be created");
  let taskList = await waitFor(
    ecs.listTasks.bind(ecs),
    {
      cluster: "bard-cluster",
      serviceName: "agent-api",
      maxResults: 1,
    },
    "taskCreated",
    true
  );
  console.log("Done.");
  console.log("Waiting for the agent-api task to start.");
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
