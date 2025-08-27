// plot.js
// Lincoln Scheer
// Solar Sim Project


// default headers to plot
const inputIndices = [31, 32, 34];
const outputIndices = [1, 2, 3, 4, 5, 6, 7];
const noPlotIndices = [16, 17, 18, 19, 20, 40, ];
let selectedInputIndices = new Set(inputIndices);
let selectedOutputIndices = new Set(outputIndices);

async function initPlot() {

	// check for sim data
	if (!simData || simData.length < 2) {
		const container = document.getElementById("combined-plot-div");
		if (container)
			container.innerHTML =
				"<p>No simulation data available to plot.</p>";
		return;
	}

	// wire resolution selector to downsample and re-render
	const resEl = document.getElementById("resolution-select");
	if (resEl && !resEl._wired) {
		resEl.addEventListener("change", (e) => {
			const val = e.target.value;
			if (typeof updatePlotSample === "function") updatePlotSample(val);
		});
		// default to hourly
		const valid = new Set(["hourly", "daily", "monthly"]);
		if (!valid.has((resEl.value || "").toLowerCase())) {
			resEl.value = "hourly";
		}
		resEl._wired = true;
	}

	// hook for updatePlotSample to re-render
	window.renderPlotFromSimData = async () => {
		try {
			await renderCombinedPlot();
		} catch (_) {}
	};

	// datetime filters for plot window
	const startEl = document.getElementById("start-datetime");
	const endEl = document.getElementById("end-datetime");
	const onRangeChange = () => {
		try { renderCombinedPlot(); } catch (_) {}
	};
	if (startEl && !startEl._wired) {
		startEl.addEventListener("change", onRangeChange);
		startEl.addEventListener("input", onRangeChange);
		startEl._wired = true;
	}
	if (endEl && !endEl._wired) {
		endEl.addEventListener("change", onRangeChange);
		endEl.addEventListener("input", onRangeChange);
		endEl._wired = true;
	}

	// build checkbox menu from headers
	buildTimeseriesMenu();

	// render with selected resolution
	if (typeof updatePlotSample === "function") {
		updatePlotSample(resEl ? resEl.value : "hourly");
	} else {
		await renderCombinedPlot();
	}
}

async function renderCombinedPlot() {
	// get headers and rows
	const headers = simData[0];
	let rows = simData.slice(1);

	// apply datetime filter if set
	const startVal = (document.getElementById('start-datetime') || {}).value || '';
	const endVal = (document.getElementById('end-datetime') || {}).value || '';
	let startTs = null, endTs = null;
	if (startVal) {
		const d = new Date(startVal);
		if (!isNaN(d)) startTs = d.getTime();
	}
	if (endVal) {
		const d = new Date(endVal);
		if (!isNaN(d)) endTs = d.getTime();
	}
	if (startTs !== null || endTs !== null) {
		rows = rows.filter(r => {
			const t = new Date(r[0]).getTime();
			if (isNaN(t)) return false;
			if (startTs !== null && t < startTs) return false;
			if (endTs !== null && t > endTs) return false;
			return true;
		});
	}

	const x = rows.map((r) => r[0]);

   // determine selected input indices (skip time at index 0)
   let inputIndices = headers
		   .slice(1)
		   .map((_, idx) => idx + 1)
		   .filter((i) => !outputIndices.includes(i) && !noPlotIndices.includes(i));
   if (!selectedInputIndices) {
	   selectedInputIndices = new Set(inputIndices);
   } else {
	   inputIndices = inputIndices.filter(i => selectedInputIndices.has(i));
   }

	// filter output indices by selection
	const activeOutputIndices = outputIndices.filter(i => selectedOutputIndices.has(i));

	// create input and output series
	   const inputSeries = inputIndices.map((i) => ({
		   x,
		   y: rows.map((r) => parseFloat(r[i])),
		   mode: "lines",
		   type: "scatter",
		   name: headers[i],
	   }));

		const outputSeries = activeOutputIndices.map((i) => ({
		   x,
		   y: rows.map((r) => parseFloat(r[i])),
		   mode: "lines",
		   type: "scatter",
		   name: headers[i],
	   }));

    // combine data for plotting
	const data = [
		...inputSeries.map((t) => ({ ...t, xaxis: "x", yaxis: "y" })),
		...outputSeries.map((t) => ({ ...t, xaxis: "x2", yaxis: "y2" })),
	];

    // plotly layout config
	const layout = {
		title: "Sunnyside Solar Simulation Results",
		grid: {
			rows: 2,
			columns: 1,
			pattern: "independent",
			roworder: "top to bottom",
			ygap: 1,
		},
		xaxis: {
			title: { text: "", font: { size: 16 } },
			domain: [0, 1],
			showticklabels: false,
		},
		yaxis: {
			title: { text: "Input Values", font: { size: 16 } },
			domain: [0.55, 1],
		},
		xaxis2: {
			title: { text: "Time", font: { size: 16 } },
			domain: [0, 1],
			matches: "x",
		},
		yaxis2: {
			title: { text: "Output Values", font: { size: 16 } },
			domain: [0, 0.45],
		},
		margin: { l: 60, r: 30, t: 60, b: 60 },
		showlegend: true,
		legend: { x: 1.02, y: 1 },
	};

    // plotly config
	const config = { responsive: true, displayModeBar: true };

    // setup container
	const container = document.getElementById("combined-plot-div");
	container.style.minHeight = "0";
	container.style.height = "100%";
	if (getComputedStyle(container).position === "static") {
		container.style.position = "relative";
	}

	// render plot
	try {

		// plotly render call
		await Plotly.newPlot(container, data, layout, config);

		// add resize listener
		if (window._plotResizeHandler) {
			window.removeEventListener("resize", window._plotResizeHandler);
		}
		window._plotResizeHandler = () => {
			try {
				// only resize if container visible
				const inDom = document.body.contains(container);
				const rect = container.getBoundingClientRect();
				const visible = rect.width > 0 && rect.height > 0;
				if (!inDom || !visible) return;
				const p = Plotly.Plots.resize(container);
				if (p && typeof p.then === "function") {
					p.catch(() => {});
				}
			} catch (_) {}
		};
		window.addEventListener("resize", window._plotResizeHandler, { passive: true });
    
    // on error show message
	} catch (err) {
		console.error("Plotly failed to render:", err);
	}
}

function buildTimeseriesMenu() {
	const menu = document.getElementById('timeseries-menu');
	const btn = document.getElementById('timeseriesDropdown');
	if (!menu || !btn || !simData || simData.length < 2) return;

	const headers = simData[0];
	const allInput = headers
		.slice(1)
		.map((_, idx) => idx + 1)
		.filter((i) => !outputIndices.includes(i) && !noPlotIndices.includes(i));

	// init selection if needed
	if (!selectedInputIndices) selectedInputIndices = new Set(allInput);

	// clear and rebuild menu
	menu.innerHTML = '';

	// create checkbox items
	const makeItem = (idx, name, checked, group) => {
		const li = document.createElement('li');
		const label = document.createElement('label');
		label.className = 'dropdown-item d-flex align-items-center gap-2';
		const cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.className = 'form-check-input m-0';
		cb.checked = checked;
		cb.dataset.index = String(idx);
		cb.dataset.group = group; // 'input' or 'output'
		const span = document.createElement('span');
		span.textContent = name;
		label.appendChild(cb);
		label.appendChild(span);
		li.appendChild(label);
		menu.appendChild(li);
		cb.addEventListener('change', () => {
			const i = Number(cb.dataset.index);
			if (cb.dataset.group === 'input') {
				if (cb.checked) selectedInputIndices.add(i); else selectedInputIndices.delete(i);
			} else {
				if (cb.checked) selectedOutputIndices.add(i); else selectedOutputIndices.delete(i);
			}
			updateTimeseriesButtonLabel(btn);
			renderCombinedPlot();
		});
	};

	// add inputs
	allInput.forEach(i => makeItem(i, headers[i], selectedInputIndices.has(i), 'input'));

	// add divider
	const divider = document.createElement('li');
	divider.innerHTML = '<hr class="dropdown-divider">';
	menu.appendChild(divider);

	// add outputs
	outputIndices.forEach(i => makeItem(i, headers[i], selectedOutputIndices.has(i), 'output'));

	updateTimeseriesButtonLabel(btn);
}

function updateTimeseriesButtonLabel(btn) {
	if (!btn) return;
	const inCount = selectedInputIndices ? selectedInputIndices.size : 0;
	const outCount = selectedOutputIndices ? selectedOutputIndices.size : 0;
	btn.textContent = `Selected: ${inCount + outCount}`;
}
