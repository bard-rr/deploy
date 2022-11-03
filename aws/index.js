import { ECS, waitUntilTasksRunning } from "@aws-sdk/client-ecs";
import { EFS } from "@aws-sdk/client-efs";
import dotenv from "dotenv";

const waitForTask = async (taskName) => {
  let output = await waitUntilTasksRunning(
    {
      client: this,
      maxWaitTime: 90, //task created from browser runs within 90 sec
    },
    {
      cluster: "bard-cluster",
      tasks: [taskName],
    }
  );
  console.log("wait output", output);
};

const fileSystemIsReady = async (fileSystem, efs) => {
  return new Promise((res, rej) => {
    setTimeout(async () => {
      console.log("checking file system status");
      let output = await efs.describeFileSystems({
        FileSystemId: fileSystem.FileSystemId,
      });
      console.log("describe file system output", output);
      res(output);
    }, 10 * 1000); //TODO: be more intelligent about this.
  });
};

const main = async () => {
  dotenv.config();
  const ecs = new ECS({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });
  const efs = new EFS({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });
  ecs.waitForTask = waitForTask;
  console.log("created an ecs client");
  //FARGATE and FARGATE_SPOT cap providers should be associated with the ecs client
  //if you want to use fargate:
  //https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
  const fileSystem = await efs.createFileSystem({});
  console.log("created file system!", fileSystem);
  const fileSystemStatus = await fileSystemIsReady(fileSystem, efs);
  await efs.createMountTarget({
    FileSystemId: fileSystem.FileSystemId,
    SubnetId: "subnet-08e97a8a4d3098617", //TODO: How to get this?
    SecurityGroups: ["sg-0824cc4158587a789"], //TODO: How to get this?
  });
  const cluster = await ecs.createCluster({
    capacityProviders: ["FARGATE", "FARGATE_SPOT"],
    clusterName: "bard-cluster",
  });
  console.log("created cluster");
  const taskDef = await ecs.registerTaskDefinition({
    family: "postgres-task",
    //TODO: does this role exist?
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

  //these also take some time to spin up once you run them... await doesn't
  //actually wait for the task to finish running. Need some other strat to do that.
  let output = await ecs.runTask({
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
  try {
    await ecs.waitForTask("postgres-task");
  } catch (error) {
    console.log("error waiting for postgres:", error);
  }
};

main();
