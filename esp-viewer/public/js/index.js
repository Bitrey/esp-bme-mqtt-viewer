const state = {
  dataReads: [],
  socket: null,
  fromDate: dateFns.subDays(new Date(), 2),
  toDate: dateFns.addDays(new Date(), 2),
  maxResults: 100
};

let tempChart, humChart, presChart;

async function init() {
  bulmaSlider.attach();

  try {
    let { fromDate, toDate, maxResults } = JSON.parse(loadCookie());

    fromDate = new Date(fromDate);
    toDate = new Date(toDate);

    maxResults = parseInt(maxResults);
    if (maxResults) {
      state.maxResults = maxResults;
      document.getElementById("max-results-slider").value = maxResults;
      document.querySelector('output[for="max-results-slider"]').textContent =
        maxResults;
    }

    console.log({ fromDate, toDate });

    if (fromDate instanceof Date && !isNaN(fromDate)) {
      state.fromDate = fromDate;
    }
    if (toDate instanceof Date && !isNaN(toDate)) {
      state.toDate = toDate;
    }

    console.log("Parsed cookie:", state);
  } catch (err) {
    console.log("Can't parse state cookie");
  }

  const { data } = await axios.get("/api", {
    params: {
      maxResults: state.maxResults,
      fromDate: state.fromDate,
      toDate: state.toDate
    }
  });

  state.dataReads = data.dataReads;

  console.log(state);

  // DEBUG - plot data
  // console.log(data);

  document.getElementById("loading").style.display = "none";
  document.getElementById("data").style.display = "block";

  chartData();
  tableData();

  const d = data.dataReads[data.dataReads.length - 1]?.date;
  setStatus(
    "Ultimo aggiornamento: " +
      (dateFns.isValid(new Date(d)) ? formatDate(d) : "-")
  );

  if (!state.socket?.connected) {
    state.socket = io();
    state.socket.on("data", data => {
      // DEBUG
      console.log({ data });

      // check if in range
      if (
        state.fromDate &&
        dateFns.isBefore(new Date(data.date), state.fromDate)
      ) {
        console.log("New data is not in data range (before)");
        return;
      } else if (
        state.toDate &&
        dateFns.isAfter(new Date(data.date), state.toDate)
      ) {
        console.log("New data is not in data range (after)");
        return;
      }

      state.dataReads.unshift(data);

      if (state.dataReads.length > state.maxResults) {
        state.dataReads.pop();
      }

      setStatus(
        "Ultimo aggiornamento: " +
          (dateFns.isValid(new Date(data.date)) ? formatDate(data.date) : "-")
      );

      // document.getElementById("render-grid").innerHTML = "";
      // tableData(state.dataReads);

      // Update data grid
      if (!dataGrid) return;
      updateDataGrid();

      if (!tempChart) return;
      updateChart(data);
      // then plot data
    });

    // Bulma calendar
    // Initialize all input of date type.
    // const datePickers = bulmaCalendar.attach('[type="date"]', {
    const datePicker = bulmaCalendar.attach("#date-picker", {
      type: "date",
      lang: "it",
      isRange: true,
      showFooter: false,
      dateFormat: "dd/MM/yyyy",
      displayMode: "default",
      startDate: state.fromDate,
      endDate: state.toDate
    })[0];
    datePicker.save();

    const timePicker = bulmaCalendar.attach("#time-picker", {
      type: "time",
      lang: "it",
      isRange: true,
      showFooter: true,
      validateLabel: "Conferma",
      clearLabel: "Resetta",
      cancelLabel: "Chiudi",
      timeFormat: "HH:mm",
      displayMode: "default",
      startTime: state.fromDate,
      endTime: state.toDate
    })[0];

    datePicker.on("select", date => {
      state.fromDate = datePicker.startDate;
      state.toDate = datePicker.endDate;
      reloadBtn.removeAttribute("disabled");
      datePicker.save();

      saveCookie();
      // reload();
    });

    let timeTimeout = null;
    timePicker.on("select", time => {
      state.fromDate.setHours(timePicker.startTime.getHours());
      state.fromDate.setMinutes(timePicker.startTime.getMinutes());
      state.toDate.setHours(timePicker.endTime.getHours());
      state.toDate.setMinutes(timePicker.endTime.getMinutes());
      reloadBtn.removeAttribute("disabled");

      if (timeTimeout) clearTimeout(timeTimeout);
      timeTimeout = setTimeout(() => timePicker.save(), 2000);

      saveCookie();
    });
  }
}

function _dataGridUpdateFn() {
  console.log("Table data updated");

  return state.dataReads.map(e => [
    formatDate(e.date /*, "HH:mm:ss" */),
    e.temp.toFixed(2) + "°C",
    e.hum.toFixed(2) + "%",
    (e.pres / 100).toFixed(2) + "hPa"
  ]);
}

function updateDataGrid() {
  dataGrid
    .updateConfig({
      data: _dataGridUpdateFn
    })
    .forceRender();
}

function updateChart(data) {
  // Update chart
  const x = new Date(data.date).toISOString();

  tempChart.data.datasets[0].data.push({ x, y: data.temp });
  humChart.data.datasets[0].data.push({ x, y: data.hum });
  presChart.data.datasets[0].data.push({ x, y: data.pres / 100 });
  if (tempChart.data.datasets[0].data.length > state.maxResults) {
    tempChart.data.datasets[0].data.shift();
    humChart.data.datasets[0].data.shift();
    presChart.data.datasets[0].data.shift();
  }
  tempChart.update();
  humChart.update();
  presChart.update();
}

function reload() {
  setStatus("Ricarica...");

  reloadBtn.setAttribute("disabled", true);

  document.getElementById("loading").style.display = "block";
  document.getElementById("data").style.display = "none";

  tempChart.destroy();
  humChart.destroy();
  presChart.destroy();

  document.getElementById("render-grid").innerHTML = "";

  init();
}

/**
 * @typedef DataRead
 * @prop {number} temp
 * @prop {number} hum
 * @prop {number} pres
 * @prop {Date} date
 */

/** @argument {DataRead[]} dataReads */
function chartData() {
  // ordine decrescente
  const dataReads = [...state.dataReads];
  dataReads.reverse();

  // console.table({
  //     temp: dataReads.map(e => e.temp),
  //     hum: dataReads.map(e => e.hum),
  //     pres: dataReads.map(e => e.pres)
  // });

  const tempCtx = document.getElementById("temp-chart").getContext("2d");
  const humCtx = document.getElementById("hum-chart").getContext("2d");
  const presCtx = document.getElementById("pres-chart").getContext("2d");

  const tempData = {
    datasets: [
      {
        label: "Temperatura",
        data: [],
        backgroundColor: "rgb(99, 143, 255)",
        borderColor: "rgb(99, 143, 255)",
        borderWidth: 1
      }
    ]
  };
  const humData = {
    datasets: [
      {
        label: "Umidità",
        data: [],
        backgroundColor: "rgb(73, 255, 66)",
        borderColor: "rgb(73, 255, 66)",
        borderWidth: 1
      }
    ]
  };
  const presData = {
    datasets: [
      {
        label: "Pressione",
        data: [],
        backgroundColor: "rgb(255, 99, 132)",
        borderColor: "rgb(255, 99, 132)",
        borderWidth: 1
      }
    ]
  };

  for (const read of dataReads) {
    const x = new Date(read.date).toISOString();
    // .tz("Europe/Rome")
    // .format("DD/MM/YY HH:mm:ss");

    tempData.datasets[0].data.push({ x, y: read.temp });
    humData.datasets[0].data.push({ x, y: read.hum });
    presData.datasets[0].data.push({ x, y: read.pres / 100 });
  }

  const defaultChart = {
    type: "line",
    options: {
      responsive: true,
      locale: "it-IT",
      scales: {
        x: {
          type: "time"
        }
      },
      plugins: {
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: "ctrl"
            },
            pinch: {
              enabled: true
            },
            mode: "x"
          }
        },

        tooltip: {
          callbacks: {
            label: context => {
              let label = context.dataset.label || "";

              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2);
                label += label.startsWith("T")
                  ? "°C"
                  : label.startsWith("U")
                  ? "%"
                  : label.startsWith("P")
                  ? "hPa"
                  : "";
                // label += new Intl.NumberFormat("en-US", {
                //     style: "currency",
                //     currency: "USD"
                // }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      }
    }
  };

  tempChart = new Chart(tempCtx, { ...defaultChart, data: tempData });
  humChart = new Chart(humCtx, { ...defaultChart, data: humData });
  presChart = new Chart(presCtx, { ...defaultChart, data: presData });
}

let dataGrid;

/** @argument {DataRead[]} dataReads */
function tableData(domElem = document.getElementById("render-grid")) {
  // const dataReads = [...state.dataReads];
  // ordine decrescente
  // dataReads.reverse();
  // console.log(gridjs, window.gridjs);
  domElem.innerHTML = "";

  if (dataGrid) {
    updateDataGrid();
  } else {
    dataGrid = new Grid({
      language: {
        search: { placeholder: "Ricerca..." },
        sort: {
          sortAsc: "Ordina ascendente",
          sortDesc: "Ordina discendente"
        },
        pagination: {
          previous: "Precedente",
          next: "Successivo",
          navigate: (e, r) => {
            return "Pagina " + e + " di " + r;
          },
          page: e => {
            return "Pagina " + e;
          },
          showing: "Stai visualizzando dalla",
          of: "su un totale di",
          to: "alla",
          results: "misurazioni"
        },
        loading: "Caricamento...",
        noRecordsFound: "Nessun risultato trovato.",
        error: "Errore durante il caricamento dei dati."
      },
      columns: ["Data", "Temperatura", "Umidità", "Pressione"],
      // Limita a 2 cifre decimali
      data: _dataGridUpdateFn,
      autoWidth: true,
      sort: true,

      pagination: {
        enabled: true,
        limit: 5,
        summary: true,
        resetPageOnUpdate: false
      }
    }).render(domElem);
  }
}

function formatDate(date, format = "DD/MM/YYYY HH:mm:ss") {
  return dateFns.format(date instanceof Date ? date : new Date(date), format);
}

function setStatus(status) {
  document.getElementById("status").textContent = status;
}

document.getElementById("max-results-slider").addEventListener("change", e => {
  const value = parseInt(e.target.value);
  state.maxResults = value;
  saveCookie();
  reload();
});

function _setCookie(name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}
function _getCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(";");
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}
function saveCookie() {
  const cookieObj = {
    fromDate: state.fromDate.toISOString(),
    toDate: state.toDate.toISOString(),
    maxResults: state.maxResults
  };
  console.log("Set cookie as", cookieObj);
  _setCookie("state", JSON.stringify(cookieObj), 100);
}
function loadCookie() {
  return _getCookie("state");
}

/** @argument {DataRead[]} dataReads */
function exportToCsv(dataReads) {
  const rows = dataReads.map(e => [
    formatDate(e.date, "YYYY-MM-DD HH:mm:ss"),
    e.temp,
    e.hum,
    e.pres
  ]);
  rows.unshift(["Data", "Temperatura", "Umidità", "Pressione"]);
  let csvContent =
    "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `Amella_IoT_Export_${formatDate(new Date(), "YYYY_MM_DD_HH_mm_ss")}.csv`
  );
  document.body.appendChild(link); // Required for FF

  link.click(); // This will download the data file named "my_data.csv".
}

document.getElementById("csv-export-btn").addEventListener("click", () => {
  exportToCsv(state.dataReads);
});

const reloadBtn = document.getElementById("reload-btn");
reloadBtn.addEventListener("click", reload);

// Re-render table on window resize
window.addEventListener("resize", tableData, true);

window.onload = () => {
  init();
};
