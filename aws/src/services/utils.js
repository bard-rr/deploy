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
