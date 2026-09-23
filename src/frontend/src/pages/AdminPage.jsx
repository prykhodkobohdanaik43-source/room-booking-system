import { useState } from 'react';
import { EventsTab } from './admin/EventsTab.jsx';
import { HistoryTab } from './admin/HistoryTab.jsx';
import { StatsTab } from './admin/StatsTab.jsx';
import { UpcomingTab } from './admin/UpcomingTab.jsx';

const tabs = [
  { id: 'upcoming', label: 'Поточні й майбутні', Component: UpcomingTab },
  { id: 'history', label: 'Історія', Component: HistoryTab },
  { id: 'stats', label: 'Статистика', Component: StatsTab },
  { id: 'events', label: 'Журнал', Component: EventsTab },
];

// Розділ адміністратора офісу (ФВ-09 – ФВ-12, ФВ-22)
export function AdminPage() {
  const [active, setActive] = useState('upcoming');
  const { Component } = tabs.find((tab) => tab.id === active);

  return (
    <section>
      <h1 className="page-title">Броні та звіти</h1>
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={tab.id === active ? 'tab tab--active' : 'tab'}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Component />
    </section>
  );
}
