import { createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, it, assert } from "vitest";
import worker, { SESSION_ID } from "../src/index";
import { tag } from "../src/tag";
import { Album } from "../src/types";
import { get_cookie } from "../src/common";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

/*
describe("Hello World worker", () => {
	it("responds with Hello World! (unit style)", async () => {
		const request = new IncomingRequest("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});

	it("responds with Hello World! (integration style)", async () => {
		const response = await SELF.fetch("https://example.com");
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});
});
*/

describe("Check html generation", () => {
	it("compiles a div tag", async () => {
		const a = tag("div").toString();
		const b = `<div></div>`;
		assert(a === b);
	});

	it("compiles a div tag with attributes", async () => {
		const a = tag("div").attrs({ "id": "placement", "class": "hello" }).toString();
		const b = `<div id="placement" class="hello"></div>`;
		assert(a === b);
	});

	it("compiles a div tag with children", async () => {
		const a = tag("div", tag("h1", "hello world")).toString();
		const b = `<div><h1>hello world</h1></div>`;
		assert(a === b);
	});
});

describe("Check album api", async () => {
	// Login as root
	const request = new IncomingRequest("http://example.com/admin/login", {
		"body": JSON.stringify({"username": "root", "password": "password"}),
		"headers": {
			"content-type": "application/json",
		},
	});
	const ctx = createExecutionContext();
	const res = await worker.fetch(request, env, ctx);
	const session_id = get_cookie(res, SESSION_ID);
	assert(session_id != null, "Session cookie not found");

	it("create album", async () => {
		// Make request
		const request = new IncomingRequest("http://example.com/api/album", {
			"headers": {
				"cookie": session_id,
			}
		});
		const ctx = createExecutionContext();
		await worker.fetch(request, env, ctx);
		// Get database result
		const result = await env.DB.prepare("SELECT * FROM albums").all<Album>();
		assert(1 === result.results.length);
	});
	it("update album", async () => {

	});
	it("delete album", async () => {

	});
});

describe("Check image api", () => {
	it("create image", async () => {

	});
	it("delete image", async () => {

	});
});
