#!/bin/zsh

SECRETJSON=$( cat web/secret.json )
CDKOUTJSON=$( cat web/cdk-outputs.json )
AWSEXPORTS=$( cat src/aws-exports.js )
AMPLIFYCONF=$( cat src/amplifyconfiguration.json )

aws secretsmanager create-secret --name mgtstore/secret \
--description "Third Party Secrets for MTG Store" \
--secret-string "$SECRETJSON" --region us-east-1 --profile a1

aws secretsmanager create-secret --name mgtstore/cdk \
--description "AWS Infrastructure for MTG Store" \
--secret-string "$CDKOUTJSON" --region us-east-1 --profile a1

aws secretsmanager create-secret --name mgtstore/awsexports \
--description "AWS Infrastructure for MTG Store" \
--secret-string "$AWSEXPORTS" --region us-east-1 --profile a1

aws secretsmanager create-secret --name mgtstore/amplifyconf \
--description "AWS Infrastructure for MTG Store" \
--secret-string "$AMPLIFYCONF" --region us-east-1 --profile a1