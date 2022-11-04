import { getOrCreateDiscoveryService, waitFor } from "./utils.js";

export const makeClickhouseService = async (
  ecs,
  fileSystemId,
  taskName,
  serviceDiscoveryClient,
  namespaceId
) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default? It does not.
    //https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "bardrr/clickhouse:latest",
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
            "awslogs-region": "us-east-1",
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
  console.log("created the clickhouse task");

  let discoveryServiceArn = await getOrCreateDiscoveryService(
    serviceDiscoveryClient,
    namespaceId,
    "rabbitmq"
  );
  console.log("clickhouse discovery service arn obtained", discoveryServiceArn);

  let serviceOutput = await ecs.createService({
    taskDefinition: taskName,
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
        subnets: ["subnet-08e97a8a4d3098617"],
        securityGroups: ["sg-0d105c4a0fc827061"],
        assignPublicIp: "ENABLED",
      },
    },
    serviceRegistries: [
      {
        registryArn: discoveryServiceArn,
      },
    ],
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
      serviceName: "clickhouse",
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
