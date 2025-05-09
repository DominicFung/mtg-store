import sys
import json

def writeAWSExports(input_file, output_file="src/aws-exports.js"):
    try:
        with open(input_file, "r") as f:
            data = json.load(f)

        st = f"""
/* eslint-disable */
// WARNING, this was created using DOM's Script (writeAWSExports.py) - NOT AWS AMPLIFY ... should work.

const awsmobile = {{
    "aws_project_region": "{data["mgtstore-AppsyncStack"]["StackRegion"]}",
    "aws_appsync_graphqlEndpoint": "{data["mgtstore-AppsyncStack"]["awsAppsyncApiEndpoint"]}",
    "aws_appsync_region": "{data["mgtstore-AppsyncStack"]["awsAppsyncRegion"]}",
    "aws_appsync_authenticationType": "{data["mgtstore-AppsyncStack"]["awsAppsyncAuthenticationType"]}",
    "aws_appsync_apiKey": "{data["mgtstore-AppsyncStack"]["awsAppsyncApiKey"]}"
}};

export default awsmobile;
        """

        with open(output_file, "w") as f:
            f.write(st)
        
        print(f"Modified data saved to {output_file}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python writeAWSExports.py <input_json_file>")
    else:
        writeAWSExports(sys.argv[1])