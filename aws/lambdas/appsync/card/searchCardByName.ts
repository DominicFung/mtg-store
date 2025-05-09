// Lambda handler for searchCardByName
import Fuse from 'fuse.js';
import AWS from 'aws-sdk';

import { AppSyncResolverEvent } from 'aws-lambda'

const dynamo = new AWS.DynamoDB.DocumentClient();

export const handler = async (event: AppSyncResolverEvent<{name: string}>) => {
  const searchName = event.arguments.name;

  // Scan all cards (or filter intelligently)
  const data = await dynamo.scan({ TableName: 'Cards' }).promise();
  const cards = data.Items;

  const fuse = new Fuse(cards||[], {
    keys: ['name'],
    threshold: 0.4,
  });

  const result = fuse.search(searchName).map(r => r.item);

  return result;
};