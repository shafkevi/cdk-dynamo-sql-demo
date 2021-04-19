# CDK Template

<!-- ![Architecture](architecture.svg) -->
## Demonstration
```bash
# Clone the Repo:
git clone git@github.com:shafkevi/cdk-dynamo-sql-demo.git && cd cdk-dynamo-sql-demo && ls | grep -v src | xargs rm -rf && cd src/app

# Install the dependencies
npm install

# Run the API
node api.js
```


## Setup

  1. Install CDK globally: `npm install -g aws-cdk`
  2. Install local Node.js dependencies: `npm install`
  3. Build the project: `npm run build`
  4. Bootstrap the CDK Toolkit into your AWS account: `cdk bootstrap`

## Useful Commands

  * `npm run build` compile project to `dist`
  * `npm run clean` delete everything in `cdk.out` and `dist`
  * `npm run watch` watch for changes and compile
  * `cdk ls` list stacks available for deployment
  * `cdk deploy` deploy this stack to your default AWS account/region
  * `cdk diff` compare deployed stack with current state
  * `cdk synth` emits the synthesized CloudFormation template
