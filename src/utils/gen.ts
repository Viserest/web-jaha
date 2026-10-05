import { execFileSync } from "node:child_process";
import { argv } from "node:process";

const node_path = argv[0];
console.log(node_path);

const file_path = argv[1];
console.log(file_path);

const option = argv[2];
if (option == "clear") {
	execFileSync(
		"rm",
		[
			"-rf", "src/generated",
		],
		{
			stdio: "inherit",
		},
	);
}
else if (option == "api") {
	// generate typescript
	//
	// "npx @openapitools/openapi-generator-cli generate -i openapi.yaml -g typescript-fetch -o src/generated/api"
	execFileSync(
		"npx",
		[
			"@openapitools/openapi-generator-cli", "generate",
			"-i", "openapi/handler.yaml",
			"-g", "typescript-fetch",
			"-o", "src/generated/api",
			"-t", "openapi-templates/typescript-fetch",
			"--type-mappings", "uuid=Uuid",
			"--type-mappings", "UUID=Uuid",
			"--import-mappings", "Uuid=../../../uuid",
		],
		{
			stdio: "inherit",
		},
	);
}
else if (option == "sql") {
	// generate typescript
	//
	// "npx @openapitools/openapi-generator-cli generate -i openapi.yaml -g typescript-fetch -o src/generated/api"
	execFileSync(
		"npx",
		[
			"@openapitools/openapi-generator-cli", "generate",
			"-i", "openapi/schemas.yaml",
			"-g", "mysql-schema",
			"-o", "src/generated/sql"
		],
		{
			stdio: "inherit",
		},
	);
}
else {
	console.log("UNKNOWN OPTION: clear, api or sql");
}
