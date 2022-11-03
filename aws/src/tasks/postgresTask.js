import { waitFor } from "./utils.js";

export const makePostgresTask = async (ecs, fileSystem, taskName) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
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
          fileSystemId: fileSystem.FileSystemId,
        },
      },
      {
        name: "persistPg",
        efsVolumeConfiguration: {
          fileSystemId: fileSystem.FileSystemId,
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

  let runTaskOutput = await ecs.runTask({
    taskDefinition: "postgres-task",
    cluster: "bard-cluster",
    count: 1,
    launchType: "FARGATE",
    //required by fargate: TODO. got these from the console. How can I get them programatically?
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ["subnet-08e97a8a4d3098617"],
        securityGroups: ["sg-0824cc4158587a789"],
        assignPublicIp: "ENABLED",
      },
    },
  });
  console.log("executed the postgres task");
  console.log("waiting for postgres task");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [runTaskOutput.tasks[0].taskArn],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("postgres started successfully!");
};
