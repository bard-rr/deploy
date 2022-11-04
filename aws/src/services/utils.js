const wait = (ms) => new Promise((res) => setTimeout(res, ms));

export const waitFor = async (fn, fnArgs, valType, desiredVal, depth = 0) => {
  const result = await fn(fnArgs);
  let resVal;
  switch (valType) {
    case "fileSystemAvailable":
      resVal = result.FileSystems[0].LifeCycleState;
      break;
    case "mountTargetAvailable":
      resVal = result.MountTargets[0].LifeCycleState;
      break;
    case "taskRunning":
      resVal = result.tasks[0].lastStatus;
      break;
    case "serviceActive":
      resVal = result.services[0].status;
      break;
    case "taskCreated":
      resVal = result.taskArns.length !== 0;
      break;

    default:
      return;
  }
  if (resVal === desiredVal) {
    console.log("resVal", resVal, "desired Val", desiredVal);
    //we have what we want
    return result;
  } else {
    if (depth > 15 || resVal === "STOPPED") {
      throw result;
    }
    console.log(`Waiting for ${2 ** depth * 10} ms`);
    await wait(2 ** depth * 10);
    return await waitFor(fn, fnArgs, valType, desiredVal, depth + 1);
  }
};

export const getOrCreateDiscoveryService = async (
  serviceDiscovery,
  namespaceId,
  serviceName
) => {
  console.log(`searching for existing discovery services named ${serviceName}`);
  let existingServices = await serviceDiscovery.listServices({
    MaxResults: 10,
    Filters: [
      {
        Name: "NAMESPACE_ID",
        Values: [namespaceId],
      },
    ],
  });
  //console.log("existing services", existingServices);
  let wantedService = existingServices.Services.find(
    (service) => service.Name === serviceName
  );
  //console.log("wanted service", wantedService);
  if (wantedService) {
    console.log(`found existing discovery service for ${serviceName}`);
    return wantedService.Arn;
  } else {
    console.log(`no discovery service found for ${serviceName}. creating one.`);
    let newService = await serviceDiscovery.createService({
      Name: serviceName,
      NamespaceId: namespaceId,
      DnsConfig: {
        RoutingPolicy: "WEIGHTED",
        DnsRecords: [
          {
            Type: "A",
            TTL: 300,
          },
        ],
      },
    });
    return newService.Service.Arn;
  }
};
