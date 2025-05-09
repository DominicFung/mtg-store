"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// Lambda handler for searchCardByName
const fuse_js_1 = __importDefault(require("fuse.js"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const dynamo = new aws_sdk_1.default.DynamoDB.DocumentClient();
const handler = async (event) => {
    const searchName = event.arguments.name;
    // Scan all cards (or filter intelligently)
    const data = await dynamo.scan({ TableName: 'Cards' }).promise();
    const cards = data.Items;
    const fuse = new fuse_js_1.default(cards || [], {
        keys: ['name'],
        threshold: 0.4,
    });
    const result = fuse.search(searchName).map(r => r.item);
    return result;
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoQ2FyZEJ5TmFtZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlYXJjaENhcmRCeU5hbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsc0NBQXNDO0FBQ3RDLHNEQUEyQjtBQUMzQixzREFBMEI7QUFJMUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxpQkFBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUUxQyxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBMkMsRUFBRSxFQUFFO0lBQzNFLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO0lBRXhDLDJDQUEyQztJQUMzQyxNQUFNLElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBRXpCLE1BQU0sSUFBSSxHQUFHLElBQUksaUJBQUksQ0FBQyxLQUFLLElBQUUsRUFBRSxFQUFFO1FBQy9CLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNkLFNBQVMsRUFBRSxHQUFHO0tBQ2YsQ0FBQyxDQUFDO0lBRUgsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFeEQsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyxDQUFDO0FBZlcsUUFBQSxPQUFPLFdBZWxCIiwic291cmNlc0NvbnRlbnQiOlsiLy8gTGFtYmRhIGhhbmRsZXIgZm9yIHNlYXJjaENhcmRCeU5hbWVcbmltcG9ydCBGdXNlIGZyb20gJ2Z1c2UuanMnO1xuaW1wb3J0IEFXUyBmcm9tICdhd3Mtc2RrJztcblxuaW1wb3J0IHsgQXBwU3luY1Jlc29sdmVyRXZlbnQgfSBmcm9tICdhd3MtbGFtYmRhJ1xuXG5jb25zdCBkeW5hbW8gPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKGV2ZW50OiBBcHBTeW5jUmVzb2x2ZXJFdmVudDx7bmFtZTogc3RyaW5nfT4pID0+IHtcbiAgY29uc3Qgc2VhcmNoTmFtZSA9IGV2ZW50LmFyZ3VtZW50cy5uYW1lO1xuXG4gIC8vIFNjYW4gYWxsIGNhcmRzIChvciBmaWx0ZXIgaW50ZWxsaWdlbnRseSlcbiAgY29uc3QgZGF0YSA9IGF3YWl0IGR5bmFtby5zY2FuKHsgVGFibGVOYW1lOiAnQ2FyZHMnIH0pLnByb21pc2UoKTtcbiAgY29uc3QgY2FyZHMgPSBkYXRhLkl0ZW1zO1xuXG4gIGNvbnN0IGZ1c2UgPSBuZXcgRnVzZShjYXJkc3x8W10sIHtcbiAgICBrZXlzOiBbJ25hbWUnXSxcbiAgICB0aHJlc2hvbGQ6IDAuNCxcbiAgfSk7XG5cbiAgY29uc3QgcmVzdWx0ID0gZnVzZS5zZWFyY2goc2VhcmNoTmFtZSkubWFwKHIgPT4gci5pdGVtKTtcblxuICByZXR1cm4gcmVzdWx0O1xufTsiXX0=