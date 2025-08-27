// script.js
// Lincoln Scheer
// Solar Sim Project

// === Navigation Globals ===

const viewContainer = document.getElementById("view");
let currentView = "home";

// === Simulation Data Globals ===
let simData = null; // current resolution sim data
let rawData = null; // immutable raw sim data (hourly)
let dataRes = "hourly";

// === Data Mapping Unit Headers ===
const unitLUT = {
	datetime: "DATETIME",
	ac: "AC Power [W]",
	dc_p: "DC Power [W]",
	dc_i: "DC Current [A]",
	dc_v: "DC Voltage [V]",
	dc_isc: "DC Short Circuit Current [A]",
	dc_vac: "DC Open Circuit Voltage [V]",
	cell_temp: "Cell Temperature [°C]",
	poa_global: "Plane of Array Global Irradiance [W/m²]",
	poa_direct: "Plane of Array Direct Irradiance [W/m²]",
	poa_diffuse: "Plane of Array Diffuse Irradiance [W/m²]",
	poa_sky_diffuse: "Plane of Array Sky Diffuse Irradiance [W/m²]",
	poa_ground_diffuse: "Plane of Array Ground Diffuse Irradiance [W/m²]",
	aoi: "Angle of Incidence [°]",
	airmass_rel: "Relative Airmass [Dimensionless]",
	airmass_abs: "Absolute Airmass [Dimensionless]",
	Year: "Year [year]",
	Month: "Month [month]",
	Day: "Day [day]",
	Hour: "Hour [hour]",
	Minute: "Minute [min]",
	temp_air: "Air Temperature [°C]",
	Alpha: "Alpha [Number]",
	"Aerosol Optical Depth": "Aerosol Optical Depth [Number]",
	Asymmetry: "Asymmetry [Number]",
	dhi_clear: "DHI Clear [W/m²]",
	dni_clear: "DNI Clear [W/m²]",
	ghi_clear: "GHI Clear [W/m²]",
	"Cloud Fill Flag": "Cloud Fill Flag [String]",
	"Cloud Type": "Cloud Type [String]",
	temp_dew: "Dew Point Temperature [°C]",
	dhi: "DHI [W/m²]",
	dni: "DNI [W/m²]",
	"Fill Flag": "Fill Flag [String]",
	ghi: "GHI [W/m²]",
	Ozone: "Ozone [cm]",
	relative_humidity: "Relative Humidity [%]",
	solar_zenith: "Solar Zenith [°]",
	SSA: "SSA [Number]",
	albedo: "Albedo [Number]",
	pressure: "Pressure [Pa]",
	precipitable_water: "Precipitable Water [cm]",
	wind_direction: "Wind Direction [°]",
	wind_speed: "Wind Speed [m/s]",
};

// === Down Sample Routines ====

// Column index constants for readability (based on current data schema)
const YEAR_IDX = 16;
const MONTH_IDX = 17;
const DAY_IDX = 18;
const HOUR_IDX = 19;
const MINUTE_IDX = 20;

/**
 * Returns an array of date ranges for each week (Monday–Sunday) in the year.
 * Allows data aggregation to use week-based intervals.
 *
 * @param {*} year (number)
 * @returns {Array} Array of week ranges
 */
function getWeekRanges(year) {
	const weeks = [];

	// Start with the first day of the year
	let d = new Date(year, 0, 1);


	// Find first monday
	while (d.getDay() !== 1) d.setDate(d.getDate() + 1);

	// Collect weeks
	while (d.getFullYear() === year) {
		const start = new Date(d);
		const end = new Date(d);
		end.setDate(end.getDate() + 6);
		weeks.push({ start: new Date(start), end: new Date(end) });
		d.setDate(d.getDate() + 7);
	}

	return weeks;
}

/**
 * Returns array of date ranges for each month (1–12) in the year.
 * Allows data aggregation to use month-based intervals.
 *
 * @param {*} year (number)
 * @returns {Array} Array of month ranges
 */
function getMonthRanges(year) {
	const months = [];

	// Collect months
	for (let m = 0; m < 12; m++) {
		const start = new Date(year, m, 1);
		const end = new Date(year, m + 1, 0); // Last day of month
		months.push({ start, end });
	}

	return months;
}

/**
 * Parses a float value from a string in a safe manner.
 * @param {string} str
 * @returns {number}
 */
function parseSafeFloat(str) {
	const n = parseFloat(str);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Aggregates data between two dates.
 * @param {*} data
 * @param {*} start
 * @param {*} end
 */
function aggregateData(data, start, end) {
	// Pre-allocate
	const numCols = data[0].length;
	const aggRow = new Array(numCols).fill(0);
	let count = 0;

	// aggregate
	for (let i = 1; i < data.length; i++) {
		const row = data[i];
		const rowDate = new Date(
			parseSafeFloat(row[YEAR_IDX]),
			parseSafeFloat(row[MONTH_IDX]) - 1,
			parseSafeFloat(row[DAY_IDX])
		);
		if (rowDate >= start && rowDate <= end) {
			for (let j = 0; j < numCols; j++) {
				aggRow[j] += parseSafeFloat(row[j]);
			}
			count++;
		}
	}

	if (count === 0) return null;

	// re-write metadata
	aggRow[0] = new Date(start).toISOString();
	aggRow[YEAR_IDX] = start.getFullYear();
	aggRow[MONTH_IDX] = start.getMonth() + 1;
	aggRow[DAY_IDX] = start.getDate();
	if (numCols > HOUR_IDX) aggRow[HOUR_IDX] = 0;
	if (numCols > MINUTE_IDX) aggRow[MINUTE_IDX] = 0;

	return aggRow;
}

/**
 * Routine to downsample simulation data from hourly to daily, weekly, and monthly intervals.
 * @param {*} data simData object
 * @param {*} freq 'D', 'W', 'M' for Daily, Weekly, Monthly
 */
function downsample(data, freq) {

	// validate data
	if (!Array.isArray(data) || data.length < 2) return [data?.[0]?.slice?.() || []];
	
	const out = [data[0].slice()];

	// collect distinct years
	const years = new Set();
	for (let i = 1; i < data.length; i++) {
		const y = parseSafeFloat(data[i][YEAR_IDX]);
		if (Number.isFinite(y)) years.add(y);
	}

	switch (freq) {
		case "D": {
			// Aggregate over days
			const seen = new Set();
			for (let i = 1; i < data.length; i++) {
				const y = parseSafeFloat(data[i][YEAR_IDX]);
				const m = parseSafeFloat(data[i][MONTH_IDX]);
				const d = parseSafeFloat(data[i][DAY_IDX]);
				if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) continue;
				const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
				if (seen.has(key)) continue;
				seen.add(key);

				const start = new Date(y, m - 1, d);
				const end = new Date(y, m - 1, d);
				const agg = aggregateData(data, start, end);
				if (agg) out.push(agg);
			}
			break;
		}
		case "W": {
			// Aggregate over week ranges
			const sortedYears = Array.from(years).sort((a, b) => a - b);
			for (const y of sortedYears) {
				const weeks = getWeekRanges(y);
				for (const w of weeks) {
					const agg = aggregateData(data, w.start, w.end);
					if (agg) out.push(agg);
				}
			}
			break;
		}
		case "M": {
			// Aggregate over month ranges
			const sortedYears = Array.from(years).sort((a, b) => a - b);
			for (const y of sortedYears) {
				const months = getMonthRanges(y);
				for (const m of months) {
					const agg = aggregateData(data, m.start, m.end);
					if (agg) out.push(agg);
				}
			}
			break;
		}
		default: {
			console.warn("Unknown frequency:", freq);
			return [data[0].slice()];
		}
	}

	return out;
}

function updatePlotSample(freq) {
	// Map UI values to downsample frequencies
	if (!rawData || rawData.length < 2) return;
	const map = {
		daily: "D",
		monthly: "M",
		hourly: null,
	};

	const key = (freq || "hourly").toLowerCase();
	dataRes = key;
	const dsFreq = map[key];

	if (!dsFreq) {
		// Hourly/native view = use raw data
		simData = rawData;
	} else {
		// Compute a new downsampled array
		simData = downsample(rawData, dsFreq);
	}

	// Sync UI controls across views when present
	try {
		const dd = document.getElementById("resolutionDropdown");
		if (dd) dd.textContent = key.charAt(0).toUpperCase() + key.slice(1);
		const select = document.getElementById("resolution-select");
		if (select && select.value !== key) select.value = key;
	} catch (_) {}

	// Ask plot view (if present) to re-render from current simData
	if (typeof window.renderPlotFromSimData === "function") {
		window.renderPlotFromSimData();
	}

	// Ask table view (if present) to re-render from current simData
	if (typeof window.renderTableFromSimData === "function") {
		window.renderTableFromSimData();
	}
}

// === View Navigation ===

// View Lookup Table
// map an initialization function to a view.
const viewLUT = {
	//  <VIEW>: { file: "<HTML_FILE>", init: <INIT_FUNCTION> }
	home: { file: "views/home.html", init: initHome },
	run: { file: "views/run.html", init: initRun },
	results: { file: "views/plot.html", init: initPlot },
	table: { file: "views/table.html", init: initTable },
};

/**
 * Navigate to a specific view defined in viewLUT.
 * @param {string} view Name of the view key in viewLUT.
 */
async function navTo(view) {
	// currentView from view LUT, default to home if other
	currentView = viewLUT[view] ? view : "home";
	const { file, init } = viewLUT[currentView] || viewLUT.home;

	// Fetch and render view
	try {
		const res = await fetch(file, { credentials: "same-origin" });
		const html = await res.text();

		// assign content and call init()
		viewContainer.innerHTML = html;
		if (typeof init === "function") {
			await init();
		}

		// mark tab as 'active'
		document.querySelectorAll("[data-view]").forEach((a) => {
			a.classList.toggle(
				"active",
				a.getAttribute("data-view") === currentView
			);
		});

		// on fail, error msg
	} catch (err) {
		console.error("Failed to load view", currentView, err);
		viewContainer.innerHTML =
			'<div class="p-3 text-danger">Failed to load view.</div>';
	}
}

// === View Initializers ===

// Unused
function initHome() {
	/* TODO: Implement for initialization */
}
function initRun() {
	/* TODO: Implement for initialization */
}

// Other view initializers are implemented in their respective files:
// initPlot() 	> plot.js
// initTable()  > table.js
// initRun()    > run.js

// === Start ===

// Initial render
navTo(currentView);

// Parse views for clickable links, and map to callbacks.
document.addEventListener("click", (e) => {
	const a = e.target.closest && e.target.closest("[data-view]");
	if (!a) return;
	e.preventDefault();
	navTo(a.getAttribute("data-view"));
});
