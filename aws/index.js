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
};

main();
