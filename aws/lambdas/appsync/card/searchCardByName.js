"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
exports.toCard = toCard;
exports.searchCardsByName = searchCardsByName;
exports.searchCardByName = searchCardByName;
const fuse_js_1 = __importDefault(require("fuse.js"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const documentClient = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
function stringField(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
// Rows may use the GraphQL names (id, name) or the table keys (cardId, cardName).
function toCard(row) {
    var _a, _b, _c;
    const name = (_a = stringField(row.name)) !== null && _a !== void 0 ? _a : stringField(row.cardName);
    if (!name) {
        return undefined;
    }
    return {
        id: (_c = (_b = stringField(row.id)) !== null && _b !== void 0 ? _b : stringField(row.cardId)) !== null && _c !== void 0 ? _c : name,
        name,
        isRamp: row.isRamp === true,
    };
}
function searchCardsByName(cards, searchName) {
    const fuse = new fuse_js_1.default(cards, {
        keys: ['name'],
        threshold: 0.4,
    });
    return fuse.search(searchName).map((result) => result.item);
}
async function searchCardByName(event, client = documentClient) {
    var _a;
    // CARD_TABLE_NAME is mtgstore-CardTable, the table this function's role can read.
    const tableName = process.env.CARD_TABLE_NAME;
    if (!tableName) {
        throw new Error('CARD_TABLE_NAME is not set');
    }
    const cards = [];
    let exclusiveStartKey;
    do {
        const page = await client.send(new lib_dynamodb_1.ScanCommand({
            TableName: tableName,
            ExclusiveStartKey: exclusiveStartKey,
        }));
        for (const item of (_a = page.Items) !== null && _a !== void 0 ? _a : []) {
            const card = toCard(item);
            if (card) {
                cards.push(card);
            }
        }
        exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return searchCardsByName(cards, event.arguments.name);
}
const handler = (event) => searchCardByName(event);
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoQ2FyZEJ5TmFtZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlYXJjaENhcmRCeU5hbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBMEJBLHdCQVVDO0FBRUQsOENBTUM7QUFFRCw0Q0EyQkM7QUF6RUQsc0RBQTJCO0FBQzNCLDhEQUEwRDtBQUMxRCx3REFBb0c7QUFHcEcsTUFBTSxjQUFjLEdBQUcscUNBQXNCLENBQUMsSUFBSSxDQUFDLElBQUksZ0NBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBZ0IzRSxTQUFTLFdBQVcsQ0FBQyxLQUFjO0lBQ2pDLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUMzRSxDQUFDO0FBRUQsa0ZBQWtGO0FBQ2xGLFNBQWdCLE1BQU0sQ0FBQyxHQUFZOztJQUNqQyxNQUFNLElBQUksR0FBRyxNQUFBLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG1DQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1YsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUNELE9BQU87UUFDTCxFQUFFLEVBQUUsTUFBQSxNQUFBLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLG1DQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLG1DQUFJLElBQUk7UUFDMUQsSUFBSTtRQUNKLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxLQUFLLElBQUk7S0FDNUIsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxLQUFtQixFQUFFLFVBQWtCO0lBQ3ZFLE1BQU0sSUFBSSxHQUFHLElBQUksaUJBQUksQ0FBQyxLQUFLLEVBQUU7UUFDM0IsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2QsU0FBUyxFQUFFLEdBQUc7S0FDZixDQUFDLENBQUM7SUFDSCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDOUQsQ0FBQztBQUVNLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsS0FBNkMsRUFDN0MsU0FBeUIsY0FBMkM7O0lBRXBFLGtGQUFrRjtJQUNsRixNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQztJQUM5QyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDZixNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFpQixFQUFFLENBQUM7SUFDL0IsSUFBSSxpQkFBK0MsQ0FBQztJQUNwRCxHQUFHLENBQUM7UUFDRixNQUFNLElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSwwQkFBVyxDQUFDO1lBQzdDLFNBQVMsRUFBRSxTQUFTO1lBQ3BCLGlCQUFpQixFQUFFLGlCQUFpQjtTQUNyQyxDQUFDLENBQUMsQ0FBQztRQUNKLEtBQUssTUFBTSxJQUFJLElBQUksTUFBQSxJQUFJLENBQUMsS0FBSyxtQ0FBSSxFQUFFLEVBQUUsQ0FBQztZQUNwQyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDMUIsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDVCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25CLENBQUM7UUFDSCxDQUFDO1FBQ0QsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDO0lBQzVDLENBQUMsUUFBUSxpQkFBaUIsRUFBRTtJQUU1QixPQUFPLGlCQUFpQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFFTSxNQUFNLE9BQU8sR0FBRyxDQUNyQixLQUE2QyxFQUN0QixFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7QUFGdkMsUUFBQSxPQUFPLFdBRWdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEZ1c2UgZnJvbSAnZnVzZS5qcyc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBTY2FuQ29tbWFuZCwgdHlwZSBTY2FuQ29tbWFuZE91dHB1dCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5pbXBvcnQgdHlwZSB7IEFwcFN5bmNSZXNvbHZlckV2ZW50IH0gZnJvbSAnYXdzLWxhbWJkYSc7XG5cbmNvbnN0IGRvY3VtZW50Q2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKG5ldyBEeW5hbW9EQkNsaWVudCh7fSkpO1xuXG5leHBvcnQgdHlwZSBDYXJkUmVjb3JkID0ge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGlzUmFtcDogYm9vbGVhbjtcbn07XG5cbnR5cGUgQ2FyZFJvdyA9IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG5leHBvcnQgdHlwZSBDYXJkUGFnZSA9IFBpY2s8U2NhbkNvbW1hbmRPdXRwdXQsICdJdGVtcycgfCAnTGFzdEV2YWx1YXRlZEtleSc+O1xuXG5leHBvcnQgdHlwZSBDYXJkU2NhbkNsaWVudCA9IHtcbiAgc2VuZChjb21tYW5kOiBTY2FuQ29tbWFuZCk6IFByb21pc2U8Q2FyZFBhZ2U+O1xufTtcblxuZnVuY3Rpb24gc3RyaW5nRmllbGQodmFsdWU6IHVua25vd24pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPiAwID8gdmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbi8vIFJvd3MgbWF5IHVzZSB0aGUgR3JhcGhRTCBuYW1lcyAoaWQsIG5hbWUpIG9yIHRoZSB0YWJsZSBrZXlzIChjYXJkSWQsIGNhcmROYW1lKS5cbmV4cG9ydCBmdW5jdGlvbiB0b0NhcmQocm93OiBDYXJkUm93KTogQ2FyZFJlY29yZCB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IG5hbWUgPSBzdHJpbmdGaWVsZChyb3cubmFtZSkgPz8gc3RyaW5nRmllbGQocm93LmNhcmROYW1lKTtcbiAgaWYgKCFuYW1lKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4ge1xuICAgIGlkOiBzdHJpbmdGaWVsZChyb3cuaWQpID8/IHN0cmluZ0ZpZWxkKHJvdy5jYXJkSWQpID8/IG5hbWUsXG4gICAgbmFtZSxcbiAgICBpc1JhbXA6IHJvdy5pc1JhbXAgPT09IHRydWUsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZWFyY2hDYXJkc0J5TmFtZShjYXJkczogQ2FyZFJlY29yZFtdLCBzZWFyY2hOYW1lOiBzdHJpbmcpOiBDYXJkUmVjb3JkW10ge1xuICBjb25zdCBmdXNlID0gbmV3IEZ1c2UoY2FyZHMsIHtcbiAgICBrZXlzOiBbJ25hbWUnXSxcbiAgICB0aHJlc2hvbGQ6IDAuNCxcbiAgfSk7XG4gIHJldHVybiBmdXNlLnNlYXJjaChzZWFyY2hOYW1lKS5tYXAoKHJlc3VsdCkgPT4gcmVzdWx0Lml0ZW0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2VhcmNoQ2FyZEJ5TmFtZShcbiAgZXZlbnQ6IEFwcFN5bmNSZXNvbHZlckV2ZW50PHsgbmFtZTogc3RyaW5nIH0+LFxuICBjbGllbnQ6IENhcmRTY2FuQ2xpZW50ID0gZG9jdW1lbnRDbGllbnQgYXMgdW5rbm93biBhcyBDYXJkU2NhbkNsaWVudCxcbik6IFByb21pc2U8Q2FyZFJlY29yZFtdPiB7XG4gIC8vIENBUkRfVEFCTEVfTkFNRSBpcyBtdGdzdG9yZS1DYXJkVGFibGUsIHRoZSB0YWJsZSB0aGlzIGZ1bmN0aW9uJ3Mgcm9sZSBjYW4gcmVhZC5cbiAgY29uc3QgdGFibGVOYW1lID0gcHJvY2Vzcy5lbnYuQ0FSRF9UQUJMRV9OQU1FO1xuICBpZiAoIXRhYmxlTmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ0FSRF9UQUJMRV9OQU1FIGlzIG5vdCBzZXQnKTtcbiAgfVxuXG4gIGNvbnN0IGNhcmRzOiBDYXJkUmVjb3JkW10gPSBbXTtcbiAgbGV0IGV4Y2x1c2l2ZVN0YXJ0S2V5OiBDYXJkUGFnZVsnTGFzdEV2YWx1YXRlZEtleSddO1xuICBkbyB7XG4gICAgY29uc3QgcGFnZSA9IGF3YWl0IGNsaWVudC5zZW5kKG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IHRhYmxlTmFtZSxcbiAgICAgIEV4Y2x1c2l2ZVN0YXJ0S2V5OiBleGNsdXNpdmVTdGFydEtleSxcbiAgICB9KSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHBhZ2UuSXRlbXMgPz8gW10pIHtcbiAgICAgIGNvbnN0IGNhcmQgPSB0b0NhcmQoaXRlbSk7XG4gICAgICBpZiAoY2FyZCkge1xuICAgICAgICBjYXJkcy5wdXNoKGNhcmQpO1xuICAgICAgfVxuICAgIH1cbiAgICBleGNsdXNpdmVTdGFydEtleSA9IHBhZ2UuTGFzdEV2YWx1YXRlZEtleTtcbiAgfSB3aGlsZSAoZXhjbHVzaXZlU3RhcnRLZXkpO1xuXG4gIHJldHVybiBzZWFyY2hDYXJkc0J5TmFtZShjYXJkcywgZXZlbnQuYXJndW1lbnRzLm5hbWUpO1xufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IChcbiAgZXZlbnQ6IEFwcFN5bmNSZXNvbHZlckV2ZW50PHsgbmFtZTogc3RyaW5nIH0+LFxuKTogUHJvbWlzZTxDYXJkUmVjb3JkW10+ID0+IHNlYXJjaENhcmRCeU5hbWUoZXZlbnQpOyJdfQ==