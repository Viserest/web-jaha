export function now_s(): number {
	return Math.floor(Date.now() / 1000);
}

export function get_cookie(request: Request | Response, name: string): string | null {
	const cookies = request.headers.get("cookie");
	if (!cookies) return null;

	for (const part of cookies.split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key === name) {
			return decodeURIComponent(value.join("="));
		}
	}
	return null;
}

export const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
