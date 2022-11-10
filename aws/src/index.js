import { ECS } from "@aws-sdk/client-ecs";
import { EFS } from "@aws-sdk/client-efs";
import dotenv from "dotenv";
import { makePostgresService } from "./services/postgresService.js";
import { makeRabbitmqService } from "./services/rabbitmqService.js";
import { makeClickhouseService } from "./services/clickhouseService.js";
import { makeAgentApiService } from "./services/agentApiService.js";
import { makeReplayerService } from "./services/replayerService.js";
import { makeSessionEnderService } from "./services/sessionEnderService.js";
import { waitFor } from "./services/utils.js";

dotenv.config();

/*
  Nino's old variables
    AWS_VPC_ID="vpc-0bcc662d0027a013b"
    AWS_SUBNET_ID="subnet-08e97a8a4d3098617"
    AWS_SECURITY_GROUP_ID="sg-0d105c4a0fc827061"

  Marcin's old variables
    AWS_SUBNET_ID=subnet-07a5d4615304da5e5
    AWS_SECURITY_GROUP_ID=sg-01167299cc4f4f23c
*/

const main = async () => {
  const ecsClient = new ECS({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  const efsClient = new EFS({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  console.log("Creating cluster...");

  await ecsClient.createCluster({
    capacityProviders: ["FARGATE", "FARGATE_SPOT"],
    clusterName: "bard-cluster",
  });

  console.log("Done.");

  console.log("Creating and initializing Postgres EFS...");

  const postgresEfs = await efsClient.createFileSystem({});
  const postgresEfsId = postgresEfs.FileSystemId;

  await waitFor(
    efsClient.describeFileSystems.bind(efsClient),
    {
      FileSystemId: postgresEfsId,
    },
    "fileSystemAvailable",
    "available"
  );

  console.log("Done.");

  console.log("Creating and initializing Postgres EFS mount target...");

  await efsClient.createMountTarget({
    FileSystemId: postgresEfsId,
    SubnetId: process.env.AWS_SUBNET_ID,
    SecurityGroups: [process.env.AWS_SECURITY_GROUP_ID],
  });

  await waitFor(
    efsClient.describeMountTargets.bind(efsClient),
    {
      FileSystemId: postgresEfsId,
      MaxItems: 1,
    },
    "mountTargetAvailable",
    "available",
    2
  );

  console.log("Done.");

  console.log("Creating and initializing Clickhouse EFS...");

  const clickhouseEfs = await efsClient.createFileSystem({});
  const clickhouseEfsId = clickhouseEfs.FileSystemId;

  await waitFor(
    efsClient.describeFileSystems.bind(efsClient),
    {
      FileSystemId: clickhouseEfsId,
    },
    "fileSystemAvailable",
    "available"
  );

  console.log("Done.");

  console.log("Creating and initializing Clickhouse EFS mount target...");

  await efsClient.createMountTarget({
    FileSystemId: clickhouseEfsId,
    SubnetId: process.env.AWS_SUBNET_ID,
    SecurityGroups: [process.env.AWS_SECURITY_GROUP_ID],
  });

  await waitFor(
    efsClient.describeMountTargets.bind(efsClient),
    {
      FileSystemId: clickhouseEfsId,
      MaxItems: 1,
    },
    "mountTargetAvailable",
    "available",
    2
  );

  console.log("Done.");

  await makePostgresService(ecsClient, postgresEfsId, "postgres-task");
  await makeRabbitmqService(ecsClient, "rabbitmq-task");
  await makeClickhouseService(ecsClient, clickhouseEfsId, "clickhouse-task");
  await makeAgentApiService(ecsClient, "agent-api-task");
  await makeSessionEnderService(ecsClient, "session_ender-task");
  await makeReplayerService(ecsClient, "replayer-task");

  console.log("Bard deployed.");
};

main();
