import { ECS } from "@aws-sdk/client-ecs";
import { EFS } from "@aws-sdk/client-efs";
import dotenv from "dotenv";
import { makePostgresService } from "./services/postgresService.js";
import { makeRabbitmqService } from "./services/rabbitmqService.js";
import { makeClickhouseService } from "./services/clickhouseService.js";
import { makeAgentApiService } from "./services/agentApiService.js";
import { makeReplayerService } from "./services/replayerService.js";
import { makeSessionEnderService } from "./services/sessionEnderService.js";
//import { waitFor } from "./tasks/utils.js";

const main = async () => {
  let ecs;
  let efs;
  let FileSystemId;
  let fileSystem;
  let cluster;
  let postgresTask;
  try {
    dotenv.config();
    ecs = new ECS({
      region: "us-east-1",
      credentials: {
        // eslint-disable-next-line no-undef
        accessKeyId: process.env.AWS_ACCESS_KEY,
        // eslint-disable-next-line no-undef
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
    efs = new EFS({
      region: "us-east-1",
      credentials: {
        // eslint-disable-next-line no-undef
        accessKeyId: process.env.AWS_ACCESS_KEY,
        // eslint-disable-next-line no-undef
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
    // console.log("created an ecs client");

    // //TODO: uncomment the code that makes the filesystem and cluster

    // //FARGATE and FARGATE_SPOT cap providers should be associated with the ecs client
    // //if you want to use fargate:
    // //https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
    // const fileSystem = await efs.createFileSystem({});
    // FileSystemId = fileSystem.FileSystemId;
    // console.log("created file system!");
    // await waitFor(
    //   efs.describeFileSystems.bind(efs),
    //   {
    //     FileSystemId,
    //   },
    //   "fileSystemAvailable",
    //   "available"
    // );
    // console.log("file system initialized");

    // await efs.createMountTarget({
    //   FileSystemId,
    //   SubnetId: "subnet-08e97a8a4d3098617", //TODO: How to get this?
    //   SecurityGroups: ["sg-0824cc4158587a789"], //TODO: How to get this?
    // });
    // console.log("mount target created");
    // await waitFor(
    //   efs.describeMountTargets.bind(efs),
    //   {
    //     FileSystemId,
    //     MaxItems: 1,
    //   },
    //   "mountTargetAvailable",
    //   "available",
    //   2
    // );
    // console.log("mount target initialized");
    // await ecs.createCluster({
    //   capacityProviders: ["FARGATE", "FARGATE_SPOT"],
    //   clusterName: "bard-cluster",
    // });
    // console.log("created cluster");

    //hard code file system during dev things
    await makePostgresService(ecs, "fs-01293ef4db092ef8e", "postgres-task");
    await makeRabbitmqService(ecs, "fs-01293ef4db092ef8e", "rabbitmq-task");
    await makeClickhouseService(ecs, "fs-01293ef4db092ef8e", "clickhouse-task");
    await makeAgentApiService(ecs, "fs-01293ef4db092ef8e", "agent-api-task");
    await makeReplayerService(ecs, "fs-01293ef4db092ef8e", "replayer-task");
    await makeSessionEnderService(
      ecs,
      "fs-01293ef4db092ef8e",
      "session_ender-task"
    );

    console.log("\n\nscript executed successfully! 🎉 🎉 🎉\n\n");
  } catch (error) {
    console.log("error: cleaning up", error);
    //clean up everything so that I don't need to later on.
    if (fileSystem) {
      console.log("cleaning up file system");
      await efs.deleteFileSystem({
        FileSystemId,
      });
    }

    if (postgresTask) {
      console.log("cleaning up postgres task");
    }

    if (cluster) {
      console.log("cleaning up cluster");
      await ecs.deleteCluster({
        cluster: "bard-cluster",
      });
    }
  }
};

main();
