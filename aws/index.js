import {
  ECS,
  CreateCapacityProviderCommand,
  waitForTasksRunning,
  waitUntilTasksRunning,
} from "@aws-sdk/client-ecs";
import dotenv from "dotenv";

const waitForTask = async (taskName) => {
  let output = await waitUntilTasksRunning(
    {
      client: this,
      maxWaitTime: 30, //task created from browser runs within 30 sec
    },
    {
      cluster: "bard-cluster",
      tasks: [taskName],
    }
  );
  console.log("wait output", output);
};

const main = async () => {
  dotenv.config();
  const client = new ECS({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });
  client.waitForTask = waitForTask;
  console.log("created a client");
  //FARGATE and FARGATE_SPOT cap providers should be associated with the client
  //if you want to use fargate:
  //https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
  const cluster = await client.createCluster({
    capacityProviders: ["FARGATE", "FARGATE_SPOT"],
    clusterName: "bard-cluster",
  });
  console.log("created cluster");
  const taskDef = await client.registerTaskDefinition({
    family: "postgres-task",
    //TODO: does this role exist?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    requiresAttributs: [
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
      {
        targetId: null,
        targetType: null,
        value: null,
        name: "ecs.capability.task-eni",
      },
    ],
    containerDefinitions: [
      {
        logConfiguration: {
          logDriver: "awslogs",
          secretOptions: null,
          options: {
            "awslogs-group": "/ecs/test_pg",
            "awslogs-region": "us-east-1",
            "awslogs-stream-prefix": "ecs",
          },
        },
        image: "public.ecr.aws/docker/library/postgres:15-alpine",
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

  //these also take some time to spin up once you run them... await doesn't
  //actually wait for the task to finish running. Need some other strat to do that.
  let output = await client.runTask({
    taskDefinition: "postgres-task",
    cluster: "bard-cluster",
    count: 1,
    launchType: "FARGATE",
    //required by fargate: TODO. got these from the console. How can I get them programatically?
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ["subnet-08e97a8a4d3098617", "subnet-0cfa424c0f6ed7d89"],
        securityGroups: ["sg-0824cc4158587a789"],
        assignPublicIp: "ENABLED",
      },
    },
  });
  console.log("executed the postgres task");
  console.log("waiting for postgres task");
  try {
    await client.waitForTask("postgres-task");
  } catch (error) {
    console.log("error waiting for postgres:", error);
  }
};

main();
