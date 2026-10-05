(function () {
	const href = document.currentScript?.dataset.href;
	const method = document.currentScript?.dataset.method;
	const submit_e = document.getElementById(document.currentScript?.dataset.submit_id);
	const message_e = document.getElementById(document.currentScript?.dataset.message_id);
	const input_ids = JSON.parse(document.currentScript?.dataset.input_ids.replaceAll("\'", "\""));
	submit_e.onclick = async function (event) {
		if (method === "POST") event.preventDefault();

		const data_tx = {};
		// Get all names/values
		for (const id of input_ids) {
			const a = document.getElementById(id);
			if (a.name == "" || (a.required && a.value == "")) {
				message_e.innerText = "Missing required value";
				return;
			}
			data_tx[a.name] = a.value;
		}

		// Send data as json
		const res = await fetch(href, {
			"method": method,
			"body": JSON.stringify(data_tx),
			"headers": {
				"content-type": "application/json",
			},
		});

		// Handle json response
		const data_rx = res.json();
		console.log(data_rx);
		if (data_rx.location) {
			window.location.href = data_rx.location;
		}
	}
})();
