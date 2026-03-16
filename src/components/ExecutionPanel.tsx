import { useState } from 'react';
import useAppStore from '../store/store';
import type { LogicExecutionResult } from '../store/store';
import '../styles/components/ExecutionPanel.css';

type Tab = 'response' | 'state' | 'events';

function JsonDisplay({ data, label }: { data: object | null | undefined; label: string }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="execution-panel-empty">{label}</div>;
  }
  return (
    <pre className="execution-panel-json">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StateDiff({ execution }: { execution: LogicExecutionResult }) {
  const before = execution.stateBefore;
  const after = execution.stateAfter;
  const same = JSON.stringify(before) === JSON.stringify(after);

  if (same) {
    return (
      <div className="execution-panel-state-same">
        <span>State unchanged</span>
        <pre className="execution-panel-json">{JSON.stringify(after, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="execution-panel-state-diff">
      <div className="execution-panel-state-col">
        <div className="execution-panel-state-col-label execution-panel-state-col-label--before">
          Before
        </div>
        <pre className="execution-panel-json execution-panel-json--before">
          {JSON.stringify(before, null, 2)}
        </pre>
      </div>
      <div className="execution-panel-state-col">
        <div className="execution-panel-state-col-label execution-panel-state-col-label--after">
          After
        </div>
        <pre className="execution-panel-json execution-panel-json--after">
          {JSON.stringify(after, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default function ExecutionPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('response');

  const { latestExecution, executionHistory, contractState, backgroundColor, textColor, clearExecutionHistory } =
    useAppStore((state) => ({
      latestExecution: state.latestExecution,
      executionHistory: state.executionHistory,
      contractState: state.contractState,
      backgroundColor: state.backgroundColor,
      textColor: state.textColor,
      clearExecutionHistory: state.clearExecutionHistory,
    }));

  const isDark = backgroundColor === '#121212';
  const tabs: { id: Tab; label: string }[] = [
    { id: 'response', label: 'Response' },
    { id: 'state', label: 'State' },
    { id: 'events', label: 'Events' },
  ];

  const hasExecution = !!latestExecution;
  const eventCount = latestExecution?.events?.length ?? 0;

  return (
    <div className="execution-panel-root" style={{ backgroundColor }}>
      {/* Header */}
      <div
        className={`execution-panel-header ${isDark ? 'execution-panel-header--dark' : 'execution-panel-header--light'}`}
      >
        <span style={{ color: textColor }}>Execution Results</span>
        <div className="execution-panel-header-right">
          {executionHistory.length > 0 && (
            <span className="execution-panel-history-count" style={{ color: textColor }}>
              {executionHistory.length} run{executionHistory.length !== 1 ? 's' : ''}
            </span>
          )}
          {executionHistory.length > 0 && (
            <button
              className="execution-panel-clear-btn"
              onClick={clearExecutionHistory}
              title="Clear execution history"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="execution-panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`execution-panel-tab ${activeTab === tab.id ? 'execution-panel-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ color: activeTab === tab.id ? '#19c6c7' : textColor }}
          >
            {tab.label}
            {tab.id === 'events' && eventCount > 0 && (
              <span className="execution-panel-event-badge">{eventCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="execution-panel-content">
        {!hasExecution && !contractState && (
          <div className="execution-panel-placeholder">
            <div className="execution-panel-placeholder-icon">⚡</div>
            <div className="execution-panel-placeholder-text" style={{ color: textColor }}>
              Init the contract, then send a request to see results here.
            </div>
          </div>
        )}

        {!hasExecution && contractState && (
          <div className="execution-panel-placeholder">
            <div className="execution-panel-placeholder-icon">✓</div>
            <div className="execution-panel-placeholder-text" style={{ color: textColor }}>
              Contract initialized. Send a request to see the response.
            </div>
            {activeTab === 'state' && (
              <div className="execution-panel-init-state">
                <div className="execution-panel-state-col-label execution-panel-state-col-label--after">
                  Initial State
                </div>
                <pre className="execution-panel-json">{JSON.stringify(contractState, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {hasExecution && activeTab === 'response' && (
          <JsonDisplay
            data={latestExecution.response}
            label="No response returned"
          />
        )}

        {hasExecution && activeTab === 'state' && (
          <StateDiff execution={latestExecution} />
        )}

        {hasExecution && activeTab === 'events' && (
          eventCount === 0 ? (
            <div className="execution-panel-empty">No events emitted</div>
          ) : (
            <div>
              {latestExecution.events.map((event, i) => (
                <div key={i} className="execution-panel-event-item">
                  <span className="execution-panel-event-number">Event {i + 1}</span>
                  <pre className="execution-panel-json">{JSON.stringify(event, null, 2)}</pre>
                </div>
              ))}
            </div>
          )
        )}

      </div>

      {/* Footer: execution timestamp */}
      {hasExecution && (
        <div className="execution-panel-footer" style={{ color: textColor }}>
          Last run: {new Date(latestExecution.executedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
