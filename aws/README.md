## Bard AWS Deployment Script

This script will deploy a containerized version of Bard to Amazon's Elastic Container Service (ECS). This solution allows for an easy deployment of Bard that scales well thanks to the managed cloud technology offered by AWS.

### Setting up the script

First, clone this repo to your local machine, navigate to the `aws` directory and install dependencies with

```
npm install
```

Next, create a `.env` file in the `aws` directory with the following variables:

```
AWS_ACCESS_KEY
AWS_SECRET_KEY
AWS_VPC_ID
AWS_SUBNET_ID
AWS_SECURITY_GROUP_ID
```

`AWS_ACCESS_KEY` and `AWS_SECRET_KEY` are the access key and secret key for the Amazon IAM user who will own and pay for the AWS resources the script creates. The IAM user must have the below permission policies applied in order for the script to function. [See here](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_manage-attach-detach.html#add-policies-console) for more information on applying permission policies to IAM users

- `AmazonECS_FullAccess`
- `AmazonElasticFileSystemFullAccess`

`AWS_VPC_ID` and `AWS_SUBNET_ID` are the IDs of the Virtual Private Cloud (VPC) and subnet that the AWS resources will be created in. [See here](https://docs.aws.amazon.com/directoryservice/latest/admin-guide/gsg_create_vpc.html) for details on creating a VPC with a single public subnet. Once the VPC and subnet have been created, you can find their IDs using the [AWS VPC console](https://console.aws.amazon.com/vpc/).

`AWS_SECURITY_GROUP_ID` is the ID of the security group that will be associated with the AWS resources the script creates. Among other things, Security Groups control how services within the AWS cloud are able to communicate with each other. This script will apply the same security group to all components it creates; the script will only work if the security group allows communication for http over all ports. **Note that this is NOT a secure configuration:** we recommend configuring security groups according to AWS best practices once the app is running. [See here](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html) for more information on creating and working with security groups.

### Running the Script

Once the dependencies have been installed and the .env file is properly configured, execute the script by running

```
npm run start
```

Note that the script will take anywhere from 5 to 10 minutes to run.
