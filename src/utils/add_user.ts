import { execFileSync } from "node:child_process";
import * as bcrypt from "bcryptjs";
import { now_s } from "../common.ts";
import { Uuid } from "../uuid.ts";

let i = 0;
const node_path = process.argv[i++];
const js_file_path = process.argv[i++];
const username = process.argv[i++];
const password = process.argv[i++];
const role = process.argv[i++];

// add user to admin table
//
// npx wrangler d1 execute jaha --command "INSERT INTO admins (id, username, password, created_at) VALUES ()" --local
const cmd = `INSERT INTO admin (
	'id', 'username', 'password', 'role', 'created_at'
) VALUES (
	'${Uuid.random().toBytes()}', '${username}', '${bcrypt.hashSync(password, 12)}', '${role}', '${now_s()}'
)`;
execFileSync(
	"npx",
	[
		"wrangler", "d1", "execute", "jaha",
		"--command", cmd,
		"--local",
	],
	{
		stdio: "inherit",
	},
);
