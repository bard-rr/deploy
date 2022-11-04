import { ECS } from "@aws-sdk/client-ecs";
// import { EFS } from "@aws-sdk/client-efs";
import dotenv from "dotenv";
import { makePostgresService } from "./services/postgresService.js";
import { makeRabbitmqService } from "./services/rabbitmqService.js";
import { makeClickhouseService } from "./services/clickhouseService.js";
import { makeAgentApiService } from "./services/agentApiService.js";
import { makeReplayerService } from "./services/replayerService.js";
import { makeSessionEnderService } from "./services/sessionEnderService.js";
// import { waitFor } from "./services/utils.js";

const main = async () => {
  try {
    dotenv.config();
    let ecs = new ECS({
      region: process.env.REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });

    // //TODO: uncomment this code that makes the filesystem and cluster

    // let efs = new EFS({
    //   region: process.env.REGION,
    //   credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY,
    //     secretAccessKey: process.env.AWS_SECRET_KEY,
    //   },
    // });
    // console.log("created an ecs client");
    // //FARGATE and FARGATE_SPOT cap providers should be associated with the ecs client
    // //if you want to use fargate:
    // //https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
    // const fileSystem = await efs.createFileSystem({});
    // let FileSystemId = fileSystem.FileSystemId;
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
    //   SubnetId: process.env.SUBNET, //TODO: How to get this?
    //   SecurityGroups: [process.env.SECURITY_GROUP], //TODO: How to get this?
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
    await ecs.createCluster({
      capacityProviders: ["FARGATE", "FARGATE_SPOT"],
      clusterName: "bard-cluster",
    });
    console.log("created cluster");

    // hard code file system during dev things
    await makePostgresService(ecs, process.env.EFS, "postgres-task");
    await makeRabbitmqService(ecs, process.env.EFS, "rabbitmq-task");
    await makeClickhouseService(ecs, process.env.EFS, "clickhouse-task");
    await makeAgentApiService(ecs, process.env.EFS, "agent-api-task");
    await makeSessionEnderService(ecs, process.env.EFS, "session_ender-task");
    await makeReplayerService(ecs, process.env.EFS, "replayer-task");

    console.log("\n\nscript executed successfully! 🎉 🎉 🎉\n\n");
  } catch (error) {
    console.log("error in script!!!\n", error);
  }
};

main();
