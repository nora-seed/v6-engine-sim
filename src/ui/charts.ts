import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let dynoChart: Chart;
let pvChart: Chart;

export function initCharts(): void {
  const dynoCtx = document.getElementById('dynoChart') as HTMLCanvasElement;
  const pvCtx = document.getElementById('pvChart') as HTMLCanvasElement;

  if (!dynoCtx || !pvCtx) return;

  dynoChart = new Chart(dynoCtx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e8f0f8', font: { family: 'Space Grotesk' } } },
        tooltip: { backgroundColor: '#11223a', titleColor: '#00d4aa', bodyColor: '#e8f0f8', borderColor: '#1e3a5f', borderWidth: 1 }
      },
      scales: {
        x: { type: 'linear', position: 'bottom', title: { display: true, text: 'RPM', color: '#7b8ca6' }, grid: { color: '#1e3a5f' }, ticks: { color: '#7b8ca6' } },
        y: { type: 'linear', position: 'left', title: { display: true, text: 'Tork (Nm) / Güç (kW)', color: '#7b8ca6' }, grid: { color: '#1e3a5f' }, ticks: { color: '#7b8ca6' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'Özgül Yakıt (g/kWh)', color: '#ffb700' }, grid: { drawOnChartArea: false }, ticks: { color: '#ffb700' } }
      },
      animation: { duration: 300 }
    }
  });

  pvChart = new Chart(pvCtx, {
    type: 'scatter',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Hacim (L)', color: '#7b8ca6' }, grid: { color: '#1e3a5f' }, ticks: { color: '#7b8ca6' } },
        y: { type: 'linear', title: { display: true, text: 'Basınç (bar)', color: '#7b8ca6' }, grid: { color: '#1e3a5f' }, ticks: { color: '#7b8ca6' } }
      },
      animation: { duration: 0 }
    }
  });
}

export function updateDynoChart(results: Map<number, any>): void {
  if (!dynoChart) return;

  const rpm = Array.from(results.keys()).sort((a, b) => a - b);
  const torque = rpm.map(r => results.get(r)!.torque);
  const power = rpm.map(r => results.get(r)!.power);
  const bsfc = rpm.map(r => results.get(r)!.bsfc);
  const boost = rpm.map(r => results.get(r)!.boost);
  const lambda = rpm.map(r => results.get(r)!.lambda);
  const knock = rpm.map(r => results.get(r)!.knockMargin);
  const ve = rpm.map(r => results.get(r)!.volumetricEff * 100);

  dynoChart.data.datasets = [
    { label: 'Tork (Nm)', data: rpm.map((r, i) => ({ x: r, y: torque[i] })), borderColor: '#00d4aa', backgroundColor: '#00d4aa33', yAxisID: 'y', tension: 0.3, fill: true },
    { label: 'Güç (kW)', data: rpm.map((r, i) => ({ x: r, y: power[i] })), borderColor: '#0066ff', backgroundColor: '#0066ff33', yAxisID: 'y', tension: 0.3, fill: true },
    { label: 'Özgül Yakıt (g/kWh)', data: rpm.map((r, i) => ({ x: r, y: bsfc[i] })), borderColor: '#ffb700', backgroundColor: '#ffb70033', yAxisID: 'y1', tension: 0.3, borderDash: [5, 5] },
    { label: 'Turbo (bar)', data: rpm.map((r, i) => ({ x: r, y: boost[i] })), borderColor: '#ff4757', backgroundColor: '#ff475733', yAxisID: 'y1', tension: 0.3, borderDash: [2, 4] }
  ];
  dynoChart.update('none');
}

export function updatePVChart(pvDiagram: { v: number; p: number }[]): void {
  if (!pvChart) return;

  pvChart.data.datasets = [{
    label: 'PV Loop',
    data: pvDiagram.map(d => ({ x: d.v, y: d.p })),
    borderColor: '#00d4aa',
    backgroundColor: '#00d4aa22',
    showLine: true,
    fill: true,
    pointRadius: 0,
    borderWidth: 2,
    tension: 0.1
  }];
  pvChart.update('none');
}

export function destroyCharts(): void {
  dynoChart?.destroy();
  pvChart?.destroy();
}