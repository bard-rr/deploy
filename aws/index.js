import { ECS, CreateCapacityProviderCommand } from "@aws-sdk/client-ecs";
import dotenv from "dotenv";
const main = async () => {
  dotenv.config();
  const client = new ECS({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });
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
    containerDefinitions: [
      {
        image: "postgres:15",
        name: "postgres",
        //TODO: need a better value for this
        memoryReservation: 10,
        portMappings: [
          {
            containerPort: 5432,
            hostPort: 5432,
          },
        ],
      },
    ],
    //these next pieces are all required by fargate
    networkMode: "awsvpc",
    runtimePlatform: {
      cpuArchitecture: "ARM64",
      operatingSystemFamily: "LINUX",
    },
    cpu: "256",
    memory: "512",
  });
  console.log("created the postgres task");

  let output = await client.runTask({
    taskDefinition: "postgres-task",
    cluster: "bard-cluster",
    count: 1,
    launchType: "FARGATE",
    //required by fargate: TODO
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [],
        securityGroups: [],
      },
    },
  });
  console.log("executed the postgres task");
};

main();
