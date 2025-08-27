// table.js
// Lincoln Scheer
// Solar Sim Project


/**
 * Initialize the Table view (gridjs) with current simulation data.
 */
async function initTable() {
	const root = document.getElementById("table-div");
	if (!root) return;
	root.style.minHeight = "0";
	root.style.height = "100%";

	// Hook up single Download CSV button
	const dlBtn = document.getElementById('download-csv-btn');
	if (dlBtn && !dlBtn._wired) {
		dlBtn.addEventListener('click', () => {
			try {
				if (!simData || simData.length === 0) return;
				const csv = simData.map(row => row.map(cell => {
					const s = String(cell ?? '');
					// Quote fields containing comma, quote, or newline
					if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
					return s;
				}).join(',')).join('\n');
				const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `simulation_data_${dataRes || 'hourly'}.csv`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} catch (_) {}
		});
		dlBtn._wired = true;
	}

	// Expose a render hook so script.js can request a refresh when simData changes
	window.renderTableFromSimData = () => renderTable(root);

	// Initial render
	renderTable(root);
}

function renderTable(root) {
	if (!root) return;
	if (!simData || simData.length < 2) {
		root.innerHTML = "<p>No simulation data available to display.</p>";
		return;
	}

	// Clear previous content to avoid stacking multiple Grid instances
	root.innerHTML = "";

	const headers = simData[0];
	const rows = simData.slice(1);
	const grid = new gridjs.Grid({
		columns: headers,
		data: rows,
		sort: true,
		fixedHeader: true,
		resizable: true,
		className: { container: "gridjs-container responsive-grid" },
		style: {
			table: {
				"white-space": "nowrap",
			},
		},
		autoWidth: true,
	});
	grid.render(root);

	// Normalize vendor inline styles after initial render
	setTimeout(() => {
		const wrapper = root.querySelector(".gridjs-wrapper");
		const tableWrapper = root.querySelector(".gridjs-table-wrapper");
		if (wrapper)
			Object.assign(wrapper.style, {
				minHeight: "0",
				height: "100%",
				overflowY: "auto",
			});
		if (tableWrapper)
			Object.assign(tableWrapper.style, {
				minHeight: "0",
				overflowY: "auto",
			});
	}, 0);
}