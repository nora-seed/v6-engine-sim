import { Severity, SimEvent } from '../sim/types';

type LogEntry = SimEvent & { time: string };

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  warning: 2,
  info: 3,
  success: 4
};

export class EventLog {
  private container: HTMLElement;
  private toast: HTMLElement;
  private entries: LogEntry[] = [];
  private max = 120;
  private toastTimer: number | null = null;
  private lastTitle = '';
  private lastFloodAt = 0;
  private count = 1;
  private lastEl: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('logContainer') as HTMLElement;
    this.toast = document.getElementById('eventToast') as HTMLElement;
    document.getElementById('btnClearLog')?.addEventListener('click', () => {
      this.entries = [];
      this.container.innerHTML = '';
    });
  }

  push(event: SimEvent): void {
    if (event.silent && event.severity === 'info') return;

    const now = performance.now();
    if (this.lastTitle === event.title && now - this.lastFloodAt < 500) {
      this.lastFloodAt = now;
      this.count += 1;
      this.flushRepeat();
      return;
    }
    this.flushRepeat();

    this.lastTitle = event.title;
    this.lastFloodAt = now;
    this.count = 1;

    const entry: LogEntry = { ...event, time: new Date().toLocaleTimeString('tr-TR') };
    this.entries.unshift(entry);
    if (this.entries.length > this.max) this.entries.pop();

    const div = document.createElement('div');
    div.className = `log-item sev-${event.severity || 'info'}`;
    div.innerHTML = `
      <div class="log-meta">
        <span class="sev-badge">${sevLabel(event.severity)}</span>
        <span class="log-time">${entry.time}</span>
        <span class="repeat"></span>
      </div>
      <div class="log-title">${escapeHtml(event.title)}</div>
      <div class="log-msg">${escapeHtml(event.message ?? '')}</div>
    `;
    this.container.prepend(div);
    this.lastEl = div;

    while (this.container.children.length > 200) {
      this.container.lastChild?.remove();
    }

    if (event.severity && SEVERITY_ORDER[event.severity] <= 2) {
      this.showToast(event);
    }
  }

  private flushRepeat(): void {
    if (this.count > 1 && this.lastEl && this.lastEl.isConnected) {
      const el = this.lastEl.querySelector('.repeat');
      if (el) el.textContent = `×${this.count}`;
    }
  }

  showToast(event: SimEvent): void {
    this.toast.textContent = `${event.title} — ${event.message ?? ''}`;
    this.toast.className = `event-toast show sev-${event.severity}`;
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.className = 'event-toast hidden';
    }, 3500);
  }
}

function sevLabel(s: Severity): string {
  return (
    {
      critical: 'KRİTİK',
      high: 'YÜKSEK',
      medium: 'ORTA',
      warning: 'UYARI',
      info: 'BİLGİ',
      success: 'TAMAM'
    }[s] ?? 'BİLGİ'
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
