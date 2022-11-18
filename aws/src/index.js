import { ECS } from "@aws-sdk/client-ecs";
import { EFS } from "@aws-sdk/client-efs";
import { ServiceDiscovery } from "@aws-sdk/client-servicediscovery";
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
  TO DELETE
  Nino's old variables
    AWS_VPC_ID="vpc-0bcc662d0027a013b"
    AWS_SUBNET_ID="subnet-08e97a8a4d3098617"
    AWS_SECURITY_GROUP_ID="sg-0d105c4a0fc827061"

  Marcin's old variables
    AWS_SUBNET_ID=subnet-07a5d4615304da5e5
    AWS_SECURITY_GROUP_ID=sg-01167299cc4f4f23c
*/

const main = async () => {
  const NAMESPACE_NAME = "bard";
  const ecsClient = new ECS({
    region: process.env.AWS_REGION_NAME,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  let serviceDiscovery = new ServiceDiscovery({
    region: process.env.AWS_REGION_NAME,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });
  console.log("Creating and initializing service discovery namespace.");
  await serviceDiscovery.createPrivateDnsNamespace({
    Name: NAMESPACE_NAME,
    //TODO: how to get this programatically?
    Vpc: process.env.AWS_VPC_ID,
  });
  await waitFor(
    serviceDiscovery.listNamespaces.bind(serviceDiscovery),
    {
      MaxResults: 1,
      Filters: [
        {
          Name: "NAME",
          Values: [NAMESPACE_NAME],
        },
      ],
    },
    "namespaceInitialized",
    true
  );
  let namespaceList = await serviceDiscovery.listNamespaces({
    MaxResults: 1,
    Filters: [
      {
        Name: "NAME",
        Values: [NAMESPACE_NAME],
      },
    ],
  });
  let namespaceId = namespaceList.Namespaces[0].Id;
  console.log("Service Discovery Namespace created");

  const efsClient = new EFS({
    region: process.env.AWS_REGION_NAME,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  console.log("Creating ECS cluster...");

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

  await makePostgresService(
    ecsClient,
    postgresEfsId,
    "postgres-task",
    serviceDiscovery,
    namespaceId
  );
  await makeRabbitmqService(
    ecsClient,
    "rabbitmq-task",
    serviceDiscovery,
    namespaceId
  );
  await makeClickhouseService(
    ecsClient,
    clickhouseEfsId,
    "clickhouse-task",
    serviceDiscovery,
    namespaceId
  );
  await makeAgentApiService(
    ecsClient,
    "agent-api-task",
    serviceDiscovery,
    namespaceId
  );
  await makeSessionEnderService(
    ecsClient,
    "session_ender-task",
    serviceDiscovery,
    namespaceId
  );
  await makeReplayerService(
    ecsClient,
    "replayer-task",
    serviceDiscovery,
    namespaceId
  );

  console.log("\n\nBard deployed successfully! 🎉 🎉 🎉\n\n");
  return;
};

main();
