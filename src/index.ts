/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Admin, AdminCreate, Pagination, Album, AlbumCreate, AlbumUpdate, Booking, BookingCreate, Image, Session, AdminUpdate, BookingUpdate, instanceOfSession, instanceOfAdmin, SessionFromJSON, AdminFromJSON } from "./generated/api";
import * as bcrypt from "bcryptjs";
import { error, html, IRequest, json, Router } from "itty-router";
import { Node, Element, tag } from "./tag";
import { clamp, get_cookie, now_s } from "./common";
import { Uuid } from "./uuid";

const SESSION_ID = "__Host-session_id";
const S3_BUCKET_URL = "https://s3.jcbphotography.com/";

/**
 * Skeleton CSS div with a row class
 *
 * @param children Array of HTML Nodes
 * @returns Image HTML Element
 */
function row(...children: Node[]): Element {
	return tag("div", ...children).attr("class", "row");
}

/**
 * Archor HTML Element with an href URL
 *
 * @param href URL
 * @param children Array of HTML Nodes
 * @returns Image HTML Element
 */
function a(href: string, ...children: Node[]): Element {
	return tag("a", ...children).attr("href", href);
}

/**
 * Image HTML Element with a src URL
 *
 * @param href URL
 * @param children Array of HTML Nodes
 * @returns Image HTML Element
 */
function img(href: string, ...children: Node[]): Element {
	return tag("img", ...children).attr("src", href);
}

/**
 * FormOptions:
 * - href: HTTP URL
 * - method: HTTP Method
 * - submit_text: The initial submit button text (Default: "Submit")
 * - message_text: The initial message paragraph text (Default: Empty string)
 */
type FormOptions = {
	href: string,
	method: string,
	submit_text?: string,
	message_text?: string,
}

/**
 * Create Form element with:
 * 1. Message paragraph
 * 2. Input fields
 * 3. Submit button
 * 4. Automatic submit using JSON
 *
 * FormOptions:
 * - href: HTTP URL
 * - method: HTTP Method
 * - submit_text: The initial submit button text
 * - message_text: The initial message paragraph text (This element is updated on submit)
 *
 * @param options FormOptions
 * @param children Child Nodes
 * @returns Form Element
 */
function form(options: FormOptions, ...children: Node[]): Element {
	// stuff
	const submit_id = Uuid.random();
	const message_id = Uuid.random();
	const ids: string[] = [];
	const result = tag("form",
		tag("p", options.message_text || "").attrs({ "id": message_id.toString() }),
		...children
	);

	// Get all inputs or textbox
	result.queryAll("input")
		.concat(result.queryAll("textarea"))
		?.forEach((a) => {
			const id = Uuid.random();
			a.attr("id", id.toString());
			ids.push(id.toString());
		});

	// Add submit and script for submitting
	result.appendChildren(
		tag("input").attrs({ "type": "submit", "id": submit_id.toString(), "value": options.submit_text || "Submit" }),
		tag("script").attrs({
			"src": "/js/form.js",
			"data-href": options.href,
			"data-method": options.method,
			"data-submit_id": submit_id.toString(),
			"data-message_id": message_id.toString(),
			"data-input_ids": JSON.stringify(ids).replaceAll("\"", "\'"),
		})
	);
	return result;
}

/**
 * Input HTML Element with a type attribute
 * (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#input_types)
 *
 * @param type Input HTML Element Type
 * @param children Array of HTML Nodes
 * @returns Input HTML Element
 */
function input(type: string, ...children: Node[]): Element {
	return tag("input", ...children).attr("type", type);
};

/**
 * Builds a HTML table using an Array of items. The callback function is called on each item
 *
 * @param table Array of items the table is built on
 * @param callback Each item's row in the table
 * @returns Table HTML Element
 */
function table<T>(table: T[], callback: (value: T) => Element): Element {
	return tag("table",
		...table.map((a) => callback(a)),
	);
}

/**
 * Default website page
 *
 * @param children Array of HTML Nodes
 * @returns Html HTML Element
 */
function Page(...children: Node[]): Element {
	return tag("html",
		tag("head",
			tag("title", "JCB Photography | Seniors, Families, Weddings, Sports, Engagements"),
			tag("link").attrs({"rel": "stylesheet", "href": "/css/normalize.css"}),
			tag("link").attrs({"rel": "stylesheet", "href": "/css/skeleton.css"}),
			tag("link").attrs({"rel": "stylesheet", "href": "/css/style.css"}),
			tag("link").attrs({"rel": "stylesheet", "href": "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400&display=swap"}),
			tag("link").attrs({"name": "viewport", "content": "width=device-width, initial-scale=1"}),
		),
		tag("body",
			// Navbar
			row(
				a("/", "HOME"),
				a("/portfolio", "PORTFOLIO"),
				tag("h1", "JCB Photography"),
				a("/contact", "CONTACT"),
				a("/album", "VIEW ALBUM"),
			).attr("class", "navbar"),
			// Main content
			row(tag("div", ...children).attr("id", "entry")).attr("id", "entry_wrapper"),
			// Footer
			row(
				tag("h3", "JCB Photography"),
				tag("p",
					"&copy; ",
					tag("script", "document.write(new Date().getFullYear())"),
					" : JCB Photography",
				),
				tag("p", "Website built by Seth Cooper"),
			).attr("class", "footer"),
		),
	).attr("lang", "en_us");
}

export interface Env {
	DB: D1Database,
	IMAGES: R2Bucket,
}
type CFArgs = [Env, ExecutionContext]
const router = Router<IRequest, CFArgs>();

/**
 * Execution steps: (Any error sends to next function)
 * 1. Get SessionId from cookies
 * 2. Get Session using SessionId
 * 3. Get Admin using Session's AdminId
 * 4. Add Admin to Request
 *
 * @param req Cloudflare request wrapped for itty-router
 * @param env Cloudflare environment
 * @param ctx Cloudflare context
 */
async function getAdmin(req: IRequest, env: Env, ctx: ExecutionContext): Promise<void> {
	// 1. Get session id cookie
	const sessionId = get_cookie(req, SESSION_ID);
	if (!sessionId) return;

	// 2. Get session
	const sessionRow = await env.DB
		.prepare("SELECT `id`, `admin_id`, `created_at`, `expires_at` FROM session WHERE `id` = ? LIMIT 1")
		.bind(sessionId)
		.first();
	if (!sessionRow || !instanceOfSession(sessionRow)) return;
	const session = SessionFromJSON(sessionRow);
	console.log(session);

	// 3. Get admin
	const adminRow = await env.DB
		.prepare("SELECT `id`, `username`, `password`, `sessions`, `role`, `created_at` FROM admin WHERE `id` = ? LIMIT 1")
		.bind(session.adminId)
		.first();
	if (!adminRow || !instanceOfAdmin(adminRow)) return;
	const admin = AdminFromJSON(adminRow);
	console.log(admin);

	// 4. Add admin to request
	req.admin = admin;
}

router.get("/favicon.ico", async (req, env, ctx) => error(404));
// GET PAGES
router.get("/", async (req, env, ctx) => {
	const stmt = env.DB.prepare("SELECT `image_ids` FROM album WHERE `name` = ? LIMIT 1");
	const result = await env.DB.batch([
		stmt.bind("jaha"),
		stmt.bind("homepage"),
	]);
	const image_id_jaha = result[0].results[0] as string;
	const image_id_homepage = result[1].results[1] as string;

	return html(Page(
		row(
			tag("div",
				img(S3_BUCKET_URL + image_id_jaha)
			).attr("class", "one-half column"),
			tag("div",
				tag("h4", "Hello, I'm Jarah Cooper Byron"),
				tag("p", "I'm a Salina native with 15 years of photography experience. I work for the local newspaper and stay busy raising my three young children with my husband, Luke."),
				tag("p", "Email Me! jarahelizabeth@gmail.com", tag("br"), "Call Me! 785-342-7777"),
			).attr("class", "one-half column"),
		),
		row(
			tag("div",
				img(S3_BUCKET_URL + image_id_homepage)
			).attr("class", "one-half column"),
			tag("div",
				tag("h5", "VIEW MORE OF MY PORTFOLIO HERE"),
				a("/portfolio", "PORTFOLIO").attr("class", "button"),
			).attr("class", "one-half column"),
		),
		row(
			tag("div",
				tag("h5", "LIKE WHAT YOU SEE?"),
				a("/contact", "BOOK NEW").attr("class", "button"),
			).attr("class", "one-half column"),
			tag("div",
				tag("h5", "HAVE SOME QUESTIONS?"),
				a("/contact", "CONTACT ME").attr("class", "button"),
			).attr("class", "one-half column"),
		),
	).toString());
});
router.get("/portfolio", async (req, env, ctx) => {
	const image_id_portfolio = await env.DB
		.prepare("SELECT `image_ids` FROM album WHERE `name` = 'portfolio'")
		.all<string>();
	return html(Page(
		...image_id_portfolio.results.map((key) => img(S3_BUCKET_URL + key)),
	).toString());
});
router.get("/contact", async (req, env, ctx) => {
	const image_id_jaha = await env.DB
		.prepare("SELECT `image_ids` FROM album WHERE `name` = 'jaha' LIMIT 1")
		.first<string>();
	return html(Page(
		row(
			tag("div",
				img(S3_BUCKET_URL + image_id_jaha)
			).attr("class", "one-half column"),
			tag("div",
				tag("h4", "Hello, I'm Jarah Cooper Byron"),
				tag("p", "I'm a Salina native with 15 years of photography experience. I work for the local newspaper and stay busy raising my three young children with my husband, Luke."),
				tag("p", "Email Me! jarahelizabeth@gmail.com", tag("br"), "Call Me! 785-342-7777"),
			).attr("class", "one-half column"),
		),
		tag("hr"),
		row(
			tag("h4", "Book Now"),
			form({
				href: "/api/booking",
				method: "POST",
				submit_text: "Book",
			},
				tag("div",
					tag("p", "* Choose Session Type"),
					((a) => tag("table",
						...a.map((b) => tag("tr",
							tag("td", b[0]),
							tag("td", b[1]),
							tag("td", b[2]),
							tag("td", b[3]),
							tag("td", tag("input").attrs({
								"type": "radio",
								"name": "sessionType",
								"value": b[4],
							})),
						))
					))([
						["Families", "1 hour", "20 edited photos", "$200", "family"],
						["HS Seniors", "30 minutes", "10 edited photos", "$100", "seniors"],
						["Regular", "1 hour", "20 edited photos", "$200", "regular"],
						["Ultimate", "2 hours", "50 edited photos", "$500", "ultimate"],
						["Events", "1 hour", "20 edited photos", "$200", "events"],
					]).attr("class", "u-full-width"),
				),
				row(
					tag("div",
						tag("span", "* Name"),
						input("text").attrs({ "placeholder": "John Handcock", "name": "name", "class": "u-full-width" }),
					).attr("class", "one-half column"),
					tag("div",
						tag("span", "* Phone Number"),
						input("text").attrs({ "placeholder": "123-456-7890", "name": "phone", "class": "u-full-width" }),
					).attr("class", "one-half column"),
				),
				row(
					tag("div",
						tag("span", "* Email Address"),
						input("text").attrs({ "placeholder": "john@example.com", "name": "email", "class": "u-full-width" }),
					).attr("class", "one-half column"),
					tag("div",
						tag("span", "* Date of Session"),
						input("date").attrs({
							"value": `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${(new Date().getDate()).toString().padStart(2, "0")}`,
							"name": "sessionDate", "class": "u-full-width",
						}),
					).attr("class", "one-half column"),
				),
				row(
					tag("div",
						tag("span", "* Send a Comment"),
						tag("textarea").attrs({ "name": "comment", "class": "u-full-width", "style": "height: 200px; resize: none;" }),
					),
				)
			),
		).attrs({ "id": "contact_form", "class": "eight columns offset-by-two" }),
	).toString());
});
router.get("/album", async (req, env, ctx) => {
	const r = (message_text?: string) => html(Page(
		tag("h3", "Open Album")
			.attr("style", "text-align: center;"),
		tag("p", "Use the album code giving to you to open up your photos!")
			.attr("style", "text-align: center;"),
		form({
			href: "/album",
			method: "GET",
			submit_text: "View Album",
			message_text,
		},
			input("text").attrs({ "placeholder": "Album Code", "name": "id", "required": "", "class": "u-full-width" }),
		).attr("class", "one-half column offset-by-three"),
	).toString());

	// Get id
	const id = req.query.id;
	if (!id) return r();

	// Get album
	const album = await env.DB
		.prepare("SELECT `id`, `name`, `image_ids`, `created_at`, `viewed_at`, `deleted_at` FROM album WHERE `id` = ? LIMIT 1")
		.bind(id)
		.first<Album>();
	if (!album) return r("Invalid album code");

	return html(Page(
		tag("h4", album.name),
		...album.imageIds.map((key) => img(S3_BUCKET_URL + key)),
	).toString());
});
router.get("/admin", getAdmin, async (req, env, ctx) => {
	if (!req.admin) {
		return new Response(Page(
			row(
				form({
					href: "/admin",
					method: "POST",
					submit_text: "Login",
				},
					input("text").attrs({ "placeholder": "Username", "name": "username", "class": "u-full-width" }),
					input("password").attrs({ "placeholder": "Password", "name": "password", "class": "u-full-width" }),
				).attr("class", "four columns offset-by-four"),
			),
		).toString(), { headers: { "content-type": "text/html" } });
	}

	// Get all tables
	const stmt = env.DB.prepare("SELECT * FROM ? LIMIT 50");
	const result = await env.DB
		.batch([
			stmt.bind("admins"),
			stmt.bind("sessions"),
			stmt.bind("bookings"),
			stmt.bind("albums"),
			stmt.bind("images"),
		]);
	const admins = result[0].results as Admin[];
	const sessions = result[1].results as Session[];
	const bookings = result[2].results as Booking[];
	const albums = result[3].results as Album[];
	const images = result[4].results as Image[];

	return html(Page(
		row(
			tag("p", "Logged in as: " + req.admin.username),
		),
		row(
			table(admins, (a) => tag("tr",
				tag("td", a.id),
				tag("td", a.createdAt),
				tag("td", a.username),
				tag("td", a.sessions.length),
				tag("td", a.role),
			)),
			table(sessions, (a) => tag("tr",
				tag("td", a.id),
				tag("td", a.adminId),
				tag("td", a.createdAt),
				tag("td", a.expiresAt),
			)),
			table(bookings, (a) => tag("tr",
				tag("td", a.id),
				tag("td", a.createdAt),
				tag("td", a.viewedAt),
				tag("td", a.deletedAt),
				tag("td", a.name),
				tag("td", a.phone),
				tag("td", a.email),
				tag("td", a.sessionType),
				tag("td", a.sessionDate.toISOString()),
				tag("td", a.comment),
			)),
			table(albums, (a) => tag("tr",
				tag("td", a.id),
				tag("td", a.createdAt),
				tag("td", a.viewedAt),
				tag("td", a.deletedAt),
				tag("td", a.name),
				tag("td", a.imageIds.length),
			)),
			table(images, (a) => tag("tr",
				tag("td", a.id),
				tag("td", a.albumId),
				tag("td", a.createdAt),
				tag("td", a.viewedAt),
				tag("td", a.deletedAt),
				tag("input").attr("type", "checkbox"),
			)),
		),
	).toString());
});
// LIST API
async function listHandler<T>(req: IRequest, env: Env, table_name: string) {
	// Get limit and offset
	let limit, offset = 0;
	try {
		let a = req.query.limit;
		if (a == null) throw new Error();
		let b = Number(a);
		limit = clamp(b, 0, 100);
	} catch {
		limit = 20;
	}
	try {
		let a = req.query.offset;
		if (a == null) throw new Error();
		offset = Number(a);
	} catch { }

	// Make database call
	const result = await env.DB
		.prepare(`SELECT * FROM ${table_name} OFFSET ? LIMIT ?`)
		.bind(offset, limit)
		.all<T>();

	// Server error
	if (!result.success) {
		return json({
			"msg": "Problem reading table",
		}, { status: 500 });
	}
	// Results empty
	if (!result.success || result.results.length === 0) {
		return json({
			"msg": "Table is empty",
		}, { status: 204 });
	}
	// Results found
	return json(<Pagination>{
		offset,
		limit,
		total: result.results.length,
		items: result.results,
	}, { "status": 200 });
}
router.get("/api/admin",   getAdmin, async (req, env, ctx) => listHandler<Admin>(req, env, "admin"));
router.get("/api/session", getAdmin, async (req, env, ctx) => listHandler<Session>(req, env, "session"));
router.get("/api/booking", getAdmin, async (req, env, ctx) => listHandler<Booking>(req, env, "booking"));
router.get("/api/album",   getAdmin, async (req, env, ctx) => listHandler<Album>(req, env, "album"));
router.get("/api/image",   getAdmin, async (req, env, ctx) => listHandler<Image>(req, env, "image"));
// POST API
async function postHandler<T>(req: IRequest, callback: (data: T, id: Uuid) => D1PreparedStatement | string, res?: string) {
	const data = await req.json<T>();

	const id = Uuid.random();
	const stmt = callback(data, id);
	if (typeof (stmt) === "string") {
		return json({
			"msg": stmt,
		}, { "status": 500 });
	}
	const result = await stmt.run();
	if (!result.success) {
		return json({
			"msg": "Problem adding to table",
		}, { "status": 500 });
	}

	return json({
		"msg": (res) ? res : "Created",
	}, { "status": 201 });
}
router.post("/admin",     getAdmin, async (req, env, ctx) => {
	// Get request data, skip role field
	const { username, password } = await req.json<AdminCreate>();

	// Query database
	const result = await env.DB
		.prepare("SELECT `id`, `username`, `password`, `sessions`, `role`, `created_at` FROM admin WHERE `username` = ? LIMIT 1")
		.bind(username)
		.first<Admin>();

	// Invalid username
	if (!result) {
		return json({
			"msg": "Invalid username",
		}, { "status": 400 });
	}

	// Invalid login
	if (!await bcrypt.compare(password, result.password)) {
		return json({
			"msg": "Invalid login credentials",
		}, { "status": 400 });
	}

	// Valid login
	// Should be 6hrs
	const EXPIRES = 6 * 60 * 60;
	const session_id = Uuid.random();
	const result2 = await env.DB
		.prepare("INSERT INTO session (`id`, `admin_id`, `created_at`, `expires_at`) VALUES (?, ?, ?, ?)")
		.bind(session_id.toBytes(), result.id, now_s(), now_s() + EXPIRES)
		.run();

	// Session didnt work
	if (!result2.success) {
		return json({
			"msg": "Problem creating session",
		}, { "status": 500 });
	}
	// Session did work
	else {
		return json({
			"msg": "Session created",
		}, {
			"status": 200,
			"headers": {
				"Location": "/admin",
				"Set-Cookie":
					`${SESSION_ID}=${encodeURIComponent(session_id.toString())}; ` +
					`Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age: ${EXPIRES}`,
			},
		});
	}
});
router.post("/api/admin", getAdmin, async (req, env, ctx) => postHandler<AdminCreate>(req, (data, id) => env.DB
		.prepare("INSERT INTO admin (`id`, `username`, `password`, `role`, `created_at`) VALUES (?, ?, ?, ?, ?)")
		.bind(id.toBytes(), data.username, bcrypt.hashSync(data.password, 12), data.role, now_s())
));
router.post("/api/booking", async (req, env, ctx) => postHandler<BookingCreate>(req, (data, id) => {
	// Validate booking information
	// Clamp name to 64 chars
	data.name = data.name.slice(0, 63);
	// Check phone number
	if (!(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im.test(data.phone))) {
		return "Invalid phone number";
	}
	// Check email
	if (!(/^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i.test(data.email))) {
		return "Invalid email";
	}
	// Check session type
	if (!["families", "seniors", "regular", "ultimate", "events"].includes(data.sessionType)) {
		return "Invalid session type";
	}
	// Check session date
	if (data.sessionDate) return "Invalid session date";
	// Check comment
	data.comment = data.comment.slice(0, 1023);
	return env.DB
		.prepare("INSERT INTO booking (`id`, `name`, `phone`, `email`, `session_type`, `session_date`, `comment`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
		.bind(id, data.name, data.phone, data.email, data.sessionType, data.sessionDate, data.comment, now_s());
}, "Booking created! We'll contact you shortly!"));
router.post("/api/album", getAdmin, async (req, env, ctx) => postHandler<AlbumCreate>(req, (data, id) => env.DB
	.prepare("INSERT INTO album (`id`, `name`, `image_ids`, `created_at`) VALUES (?, ?, ?, ?)")
	.bind(id.toBytes(), data.name, data.imageIds, now_s())
));
router.post("/api/image", getAdmin, async (req, env, ctx) => {
	// Get album id
	const album_id = req.query.album_id;
	if (!album_id) {
		return json({
			"msg": "Missing album_id query param",
		}, { "status": 400 });
	}

	if (!req.body) {
		return json({
			"msg": "Missing request body",
		}, { "status": 400 });
	}

	// Save image to r2
	const id = Uuid.random();
	const result = await env.IMAGES.put(id.toString(), req.body);
	if (!result) {
		return json({
			"msg": "Problem saving image",
		}, { "status": 500 });
	}

	// Add to image table
	const result2 = await env.DB
		.prepare("INSERT INTO image (`id`, `album_id`, `created_at`) VALUES (?, ?, ?)")
		.bind(id, album_id, now_s())
		.run();
	if (!result2.success) {
		return json({
			"msg": "Problem saving image",
		}, { "status": 500 });
	}

	return json({
		"msg": "Image saved",
	}, { "status": 200 });
});
// GET API
async function getHandler<T>(req: IRequest, env: Env, table_name: string) {
	const id = req.params["id"];
	if (!id) {
		return json({
			"msg": "Id cannot be null",
		}, { "status": 400 });
	}

	// Make database call
	const result = await env.DB
		.prepare(`SELECT * FROM ${table_name} WHERE \`id\` = ? LIMIT 1`)
		.bind(id)
		.run<T>();

	// Problem
	if (!result) {
		return json({
			"msg": "Problem reading table",
		}, { "status": 500 });
	}

	// Empty
	if (result.results.length === 0) {
		return json({
			"msg": "Table is empty",
		}, { "status": 204 });
	}

	// Success
	return json(<T>result.results[0], {
		"status": 200,
	});
}
router.get("/api/admin/:id",   getAdmin, async (req, env, ctx) => getHandler<Admin>(req, env, "admin"));
router.get("/api/session/:id", getAdmin, async (req, env, ctx) => getHandler<Session>(req, env, "session"));
router.get("/api/booking/:id", getAdmin, async (req, env, ctx) => getHandler<Booking>(req, env, "booking"));
router.get("/api/album/:id",   getAdmin, async (req, env, ctx) => getHandler<Album>(req, env, "album"));
router.get("/api/image/:id",   getAdmin, async (req, env, ctx) => getHandler<Image>(req, env, "image"));
// PUT API
async function putHandler<T>(req: IRequest, callback: (data: T, id: any) => D1PreparedStatement | string, res?: string) {
	const id = req.params["id"];
	if (!id) {
		return json({
			"msg": "Id cannot be null",
		}, { "status": 500 });
	}

	const data = await req.json<T>();

	const stmt = callback(data, id);
	if (typeof (stmt) === "string") {
		return json({
			"msg": stmt,
		}, { "status": 500 });
	}
	const result = await stmt.run();

	if (!result.success) {
		return json({
			"msg": "Problem updating album",
		}, { "status": 500 });
	}

	return json({
		"msg": (res) ? res : "Updated",
	}, { "status": 200 });
}
router.put("/api/admin/:id",   getAdmin, async (req, env, ctx) => putHandler<AdminUpdate>(req, (data, id) => {
	// Check that at least 1 field is being updated
	if (!data.username && !data.password && !data.role) return "Nothing to update!";

	// Build sql query
	let a = "UPDATE admin SET";
	let b = [];
	if (data.username) { a += " `username` = ?"; b.push(data.username); };
	if (data.password) { a += ", `password` = ?"; b.push(data.password); };
	if (data.role) { a += ", `role` = ?"; b.push(data.role); };
	a += " WHERE `id` = ?"; b.push(id);

	// Make sql statement
	return env.DB.prepare(a).bind(b);
}, "Admin updated"));
router.put("/api/booking/:id", getAdmin, async (req, env, ctx) => putHandler<BookingUpdate>(req, (data, id) => {
	// Check that at least 1 field is being updated
	if (!data.notes || data.notes.length === 0) return "Nothing to update!";

	// Build sql statement
	return env.DB
		.prepare("UPDATE booking SET `notes` = ? WHERE `id` = ?")
		.bind(data.notes, id);
}, "Booking updated"));
router.put("/api/album/:id",   getAdmin, async (req, env, ctx) => putHandler<AlbumUpdate>(req, (data, id) => {
	// Check that at least 1 field is being updated
	if (!data.name && (!data.imageIds || data.imageIds.length === 0)) return "Nothing to update!";

	// Build sql query
	let a = "UPDATE album SET";
	let b = [];
	if (data.name) { a += " `name` = ?"; b.push(data.name); };
	if (data.imageIds) { a += ", `image_ids` = ?"; b.push(data.imageIds); };
	a += " WHERE `id` = ?"; b.push(id);

	// Make sql statement
	return env.DB.prepare(a).bind(b);
}, "Album updated"));
// DELETE API
async function deleteHandler<T>(req: IRequest, env: Env, table_name: string) {
	const id = req.params["id"];
	if (!id) {
		return json({
			"msg": "Id cannot be null",
		}, { "status": 400 });
	}

	// Check if table has deleted_at column
	const result = await env.DB
		.prepare(`SELECT EXISTS (
    	SELECT 1
      FROM pragma_table_info(\`${table_name}\`)
      WHERE name = \`deleted_at\`
    );`)
		.first<number>();
	if (!result) {
		return json({
			"msg": "Problem deleting",
		}, { "status": 500 });
	}

	// Either set deleted_at column or actually delete
	const result2 = await (result === 1 ?
		env.DB
			.prepare(`UPDATE ${table_name} SET \`deleted_at\` = ? WHERE \`id\` = ?`)
			.bind(now_s(), id)
		: env.DB
			.prepare(`DELETE FROM ${table_name} WHERE \`id\` = ?`)
			.bind(id)
		)
		.run();

	if (!result2.success) {
		return json({
			"msg": "Problem deleting",
		}, { "status": 500 });
	}

	return json({
		"msg": "Deleted",
	}, { "status": 200 });
}
router.delete("/api/admin/:id",   getAdmin, async (req, env, ctx) => deleteHandler<Admin>(req, env, "admin"));
router.delete("/api/session/:id", getAdmin, async (req, env, ctx) => deleteHandler<Session>(req, env, "session"));
router.delete("/api/booking/:id", getAdmin, async (req, env, ctx) => deleteHandler<Booking>(req, env, "booking"));
router.delete("/api/album/:id",   getAdmin, async (req, env, ctx) => deleteHandler<Album>(req, env, "album"));
router.delete("/api/image/:id",   getAdmin, async (req, env, ctx) => deleteHandler<Image>(req, env, "image"));

export default {
	...router
} satisfies ExportedHandler<Env>;
