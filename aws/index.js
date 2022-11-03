import { ECS, waitUntilTasksRunning } from "@aws-sdk/client-ecs";
import { EFS } from "@aws-sdk/client-efs";
import dotenv from "dotenv";

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const waitFor = async (fn, fnArgs, valType, desiredVal, depth = 0) => {
  const result = await fn(fnArgs);
  let resVal;
  switch (valType) {
    case "fileSystemAvailable":
      resVal = result.FileSystems[0].LifeCycleState;
      break;
    case "mountTargetAvailable":
      resVal = result.MountTargets[0].LifeCycleState;
      break;

    default:
      return;
  }
  if (resVal === desiredVal) {
    console.log("resVal", resVal, "desired Val", desiredVal);
    //we have what we want
    return result;
  } else {
    if (depth > 20) {
      throw result;
    }
    console.log(`Waiting for ${2 ** depth * 10} ms`);
    await wait(2 ** depth * 10);
    return await waitFor(fn, fnArgs, valType, desiredVal, depth + 1);
  }
};

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
  console.log("created file system!");
  const fileSystemStatus = await waitFor(
    efs.describeFileSystems.bind(efs),
    {
      FileSystemId: fileSystem.FileSystemId,
    },
    "fileSystemAvailable",
    "available"
  );
  console.log("file system initialized");

  const mountTarget = await efs.createMountTarget({
    FileSystemId: fileSystem.FileSystemId,
    SubnetId: "subnet-08e97a8a4d3098617", //TODO: How to get this?
    SecurityGroups: ["sg-0824cc4158587a789"], //TODO: How to get this?
  });
  console.log("mount target created");
  const mountTargetStatus = await waitFor(
    efs.describeMountTargets.bind(efs),
    {
      FileSystemId: fileSystem.FileSystemId,
      MaxItems: 1,
    },
    "mountTargetAvailable",
    "available",
    2
  );
  console.log("mount target initialized");

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
