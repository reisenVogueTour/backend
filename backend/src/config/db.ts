import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "./env";

const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
  region: env.awsRegion,
};

if (env.dynamoEndpoint) {
  clientConfig.endpoint = env.dynamoEndpoint;
  clientConfig.credentials = {
    accessKeyId: env.awsAccessKeyId ?? "local",
    secretAccessKey: env.awsSecretAccessKey ?? "local",
  };
} else if (env.awsAccessKeyId && env.awsSecretAccessKey) {
  clientConfig.credentials = {
    accessKeyId: env.awsAccessKeyId,
    secretAccessKey: env.awsSecretAccessKey,
  };
}

const client = new DynamoDBClient(clientConfig);

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const tableName = env.dynamoTableName;
