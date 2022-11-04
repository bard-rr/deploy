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

const main = async () => {
  try {
    const NAMESPACE_NAME = "bard";
    dotenv.config();
    let ecs = new ECS({
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
    let serviceDiscovery = new ServiceDiscovery({
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
    await serviceDiscovery.createPrivateDnsNamespace({
      Name: NAMESPACE_NAME,
      //TODO: how to get this programatically?
      Vpc: "vpc-0bcc662d0027a013b",
    });
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
    console.log("namespace created");


    // // //TODO: uncomment this code that makes the filesystem and cluster

    let efs = new EFS({
      region: "us-east-1",
      credentials: {
        // eslint-disable-next-line no-undef
        accessKeyId: process.env.AWS_ACCESS_KEY,
        // eslint-disable-next-line no-undef
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
    console.log("created an ecs client");
    // FARGATE and FARGATE_SPOT cap providers should be associated with the ecs client
    // if you want to use fargate:
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
    const fileSystem = await efs.createFileSystem({});
    let FileSystemId = fileSystem.FileSystemId;
    console.log("created file system!");
    await waitFor(
      efs.describeFileSystems.bind(efs),
      {
        FileSystemId,
      },
      "fileSystemAvailable",
      "available"
    );
    console.log("file system initialized");

    await efs.createMountTarget({
      FileSystemId,
      SubnetId: "subnet-08e97a8a4d3098617", //TODO: How to get this?
      SecurityGroups: ["sg-0d105c4a0fc827061"], //TODO: How to get this?
    });
    console.log("mount target created");
    await waitFor(
      efs.describeMountTargets.bind(efs),
      {
        FileSystemId,
        MaxItems: 1,
      },
      "mountTargetAvailable",
      "available",
      2
    );
    console.log("mount target initialized");
    
    await ecs.createCluster({
      capacityProviders: ["FARGATE", "FARGATE_SPOT"],
      clusterName: "bard-cluster",
    });
    console.log("created cluster");

    // //hard code file system during dev things
    await makePostgresService(
      ecs,
      FileSystemId,
      "postgres-task",
      serviceDiscovery,
      namespaceId
    );
    await makeReplayerService(
      ecs,
      FileSystemId,
      "replayer-task",
      serviceDiscovery,
      namespaceId
    );
    await makeRabbitmqService(
      ecs,
      FileSystemId,
      "rabbitmq-task",
      serviceDiscovery,
      namespaceId
    );
    await makeClickhouseService(
      ecs,
      FileSystemId,
      "clickhouse-task",
      serviceDiscovery,
      namespaceId
    );
    await makeAgentApiService(
      ecs,
      FileSystemId,
      "agent-api-task",
      serviceDiscovery,
      namespaceId
    );
    await makeSessionEnderService(
      ecs,
      FileSystemId,
      "session_ender-task",
      serviceDiscovery,
      namespaceId
    );

    console.log("\n\nscript executed successfully! 🎉 🎉 🎉\n\n");
  } catch (error) {
    console.log("error in script!!!\n", error);
  }
};

main();
