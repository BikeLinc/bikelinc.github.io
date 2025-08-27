// run.js
// Lincoln Scheer
// Solar Sim Project


/**
 * Run the backend simulation, parse returned CSV, load dataset and navigate to results.
 * @param {string} startDate ISO date (YYYY-MM-DD)
 * @param {string} endDate ISO date (YYYY-MM-DD)
 * @param {string} meteoYear TODO: Implement on backend to use this.
 */
async function runSimulation(startDate, endDate, meteoYear) {
	// meteoYear kept for future use
	if (!startDate || !endDate) {
		alert(
			"ERROR: Missing simulation input parameter. Please ensure start and end dates are filled."
		);
		return;
	}

    // CSV parser
	const parseCSV = (csvText) =>
		csvText
			.trim()
			.split(/\r?\n/)
			.map((line) => line.split(","));
          
    // API Call
	try {
		const response = await fetch("https://sunnyside-solar.onrender.com/simulate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				start_date: startDate,
				end_date: endDate,
				losses: { soiling: 5, snow: 10 },
			}),
		});

        //  Check response OK
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`HTTP ${response.status} ${response.statusText}: ${errorText}`
			);
		}

        // Parse JSON response and throw into the loadSimData function.
		const jsonResponse = await response.json();
		if (!jsonResponse.data)
			throw new Error("Invalid response format: missing 'data' field");

		data = parseCSV(jsonResponse.data);

        // Replace headers with those mapped in unitLUT (including units if available)
        data[0] = data[0].map((col) => {
            const mapped = unitLUT[col];
            return mapped ? mapped : col;
        });

		// Convert columns 1 and 2 from W to kW (values) and update unit labels
		// Assumes column 0 is timestamp and columns 1 & 2 are power in Watts.
		// Safe-guard against short rows.
		if (data[0].length > 2) {
			// Update header units to [kW] if they contain [W]
			data[0][1] = String(data[0][1]).replace(/\[W\]/, "[kW]");
			data[0][2] = String(data[0][2]).replace(/\[W\]/, "[kW]");
		}
		for (let i = 1; i < data.length; i++) {
			const row = data[i];
			if (!row) continue;
			if (row.length > 1) {
				const v = parseFloat(row[1]);
				row[1] = Number.isFinite(v) ? String(v / 1000) : row[1];
			}
			if (row.length > 2) {
				const v2 = parseFloat(row[2]);
				row[2] = Number.isFinite(v2) ? String(v2 / 1000) : row[2];
			}
		}

		simData = data;
		rawData = data; // keep a pristine copy for resampling


        navTo("results");


	} catch (err) {
		console.error("Simulation error:", err);
		alert(
			"Failed to run simulation. Error: " +
				err.message
		);
	}
}
