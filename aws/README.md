## AWS ECS Script

This script requires a few things.

- a `.env` file with an `AWS_ACCESS_KEY` field and `AWS_SECRET_KEY` field. These credentials should correspond to an AWS user with the `AmazonECS_FullAccess` and the `AmazonElasticFileSystemFullAccess` IAM policies applied to them.

Notes to self

- Tried to create a task using an EFS volume programatically with no success. I got some errors about needing to configure my VPC to communicate with the EFS. Tried to create a task in the browser to do the same thing with the same result. Full error message is below.

```
ResourceInitializationError: failed to invoke EFS utils commands to set up EFS volumes: stderr: Failed to resolve "fs-0e4a39a0b7bb8b885.efs.us-east-1.amazonaws.com" - check that your file system ID is correct, and ensure that the VPC has an EFS mount target for this file system ID. See https://docs.aws.amazon.com/console/efs/mount-dns-name for more detail. Attempting to lookup mount target ip address using botocore. Failed to import necessary dependency botocore, please install botocore first. : unsuccessful EFS utils command execution; code: 1
```

Ok, looks like I need to mount something onto the EFS instance so that it can communicate with the outside world. Did that manually in the browser, lets see if the task I created works now... Nope, still getting that error... Odd, I made sure that the mount target is the same VPC and subnet that the task is running on... there must be something else I need to do to finish setting up the EFS.

Oh, So that just creates the mount target. looks like I actually need to do something with that mount target in order for it to work.

Tried running the task with a basic root dir in the volumes definition and got this error below.

```
ResourceInitializationError: failed to invoke EFS utils commands to set up EFS volumes: stderr: b'mount.nfs4: Connection timed out' : unsuccessful EFS utils command execution; code: 32
```

Got some help here: looks like I need to do some security group config:
https://aws.amazon.com/premiumsupport/knowledge-center/fargate-unable-to-mount-efs/

Looks like security groups are an EC2 feature. Also looks like the default one is set up to accept connections from anywhere, and that a new security group was created each time I executed a task. So THAT'S why this wasn't working: the default security group for EFS wasn't the same as the security group I was using to run the tasks with.

I've got the default security group configured to accept connections from anywhere. So it looks like as long as I run the tasks with the default security group and have the EFS mount targets use the default security group, I should be good (right?)

RIGHT!!! Looks like this works!
