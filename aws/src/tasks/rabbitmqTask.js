import { waitFor } from "./utils.js";

export const makeRabbitmqTask = async (ecs, fileSystem, taskName) => {
  await ecs.registerTaskDefinition({
    family: taskName,
    //TODO: Does this task exist by default?
    executionRoleArn: "ecsTaskExecutionRole",
    compatabilities: ["EC2", "FARGATE"],
    requiresCompatibilities: ["FARGATE"],
    containerDefinitions: [
      {
        image: "public.ecr.aws/docker/library/rabbitmq:3.11.2-alpine",
        name: "rabbitmq",
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
        //TODO: does rabbit need volumes?
        //mountPoints: [],
      },
    ],
    //TODO: does rabbit need volumes?
    volumes: [],
    //these next pieces are all required by fargate
    networkMode: "awsvpc",
    runtimePlatform: {
      operatingSystemFamily: "LINUX",
    },
    cpu: "256",
    memory: "1024",
  });
  console.log("created the rabbitmq task");

  let runTaskOutput = await ecs.runTask({
    taskDefinition: taskName,
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
  console.log("executed the rabbitmq task");
  console.log("waiting for rabbitmq task");
  await waitFor(
    ecs.describeTasks.bind(ecs),
    {
      tasks: [runTaskOutput.tasks[0].taskArn],
      cluster: "bard-cluster",
    },
    "taskRunning",
    "RUNNING"
  );
  console.log("rabbitmq started successfully!");
};
