import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import * as monacoNS from 'monaco-editor';
import useAppStore from '../store/store';
import '../styles/components/ContractRunner.css';

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.Editor }))
);

const DEFAULT_REQUEST = JSON.stringify({ increment: 1 }, null, 2);

export default function ContractRunner() {
  const [requestJson, setRequestJson] = useState(DEFAULT_REQUEST);
  const editorRef = useRef<monacoNS.editor.IStandaloneCodeEditor | null>(null);

  const {
    compiledLogicJs,
    contractState,
    isExecuting,
    isCompiling,
    logicError,
    initContract,
    triggerContract,
    backgroundColor,
    textColor,
    showLineNumbers,
  } = useAppStore((state) => ({
    compiledLogicJs: state.compiledLogicJs,
    contractState: state.contractState,
    isExecuting: state.isExecuting,
    isCompiling: state.isCompiling,
    logicError: state.logicError,
    initContract: state.initContract,
    triggerContract: state.triggerContract,
    backgroundColor: state.backgroundColor,
    textColor: state.textColor,
    showLineNumbers: state.showLineNumbers,
  }));

  const isDark = backgroundColor === '#121212';
  const themeName = isDark ? 'darkTheme' : 'lightTheme';

  const canInit = !!compiledLogicJs && !isCompiling && !isExecuting;
  const canTrigger = canInit && !!contractState;

  const stateLabel = isExecuting
    ? '⟳ Executing...'
    : contractState
    ? '● Initialized'
    : compiledLogicJs
    ? '○ Not initialized'
    : '○ No logic compiled';

  const stateLabelColor = isExecuting
    ? '#f59e0b'
    : contractState
    ? '#22c55e'
    : '#9ca3af';

  const handleInit = () => {
    void initContract();
  };

  const handleTrigger = () => {
    void triggerContract(requestJson);
  };

  // Update request JSON when sample changes — use sample's default if it has one
  const currentSampleDefault = useAppStore((s) => {
    const sample = s.samples.find((sam) => sam.NAME === s.sampleName);
    return sample?.DEFAULT_REQUEST ?? DEFAULT_REQUEST;
  });

  useEffect(() => {
    setRequestJson(currentSampleDefault);
  }, [currentSampleDefault]);

  return (
    <div className="contract-runner-root" style={{ backgroundColor }}>
      {/* Header */}
      <div
        className={`contract-runner-header ${isDark ? 'contract-runner-header--dark' : 'contract-runner-header--light'}`}
      >
        <span style={{ color: textColor }}>Contract Execution</span>
        <span className="contract-runner-state-label" style={{ color: stateLabelColor }}>
          {stateLabel}
        </span>
      </div>

      {/* Init button */}
      <div className="contract-runner-init-section">
        <button
          className="contract-runner-btn contract-runner-btn--init"
          onClick={handleInit}
          disabled={!canInit}
          title={!compiledLogicJs ? 'Apply and compile logic first' : 'Initialize contract state'}
        >
          {isExecuting && !contractState ? 'Initializing...' : 'Init Contract'}
        </button>
        {contractState && (
          <span className="contract-runner-init-badge">
            State initialized ✓
          </span>
        )}
      </div>

      <div className="contract-runner-divider" />

      {/* Request editor */}
      <div className="contract-runner-request-label" style={{ color: textColor }}>
        Request JSON
      </div>
      <div className="contract-runner-request-editor">
        <Suspense fallback={<div className="contract-runner-editor-loading">Loading...</div>}>
          <MonacoEditor
            language="json"
            height="140px"
            value={requestJson}
            theme={themeName}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: showLineNumbers ? 'on' : 'off',
              wordWrap: 'on',
              fontSize: 12,
              mouseWheelZoom: false,
              scrollbar: {
                alwaysConsumeMouseWheel: false,
              },
            }}
            onChange={(v) => setRequestJson(v ?? '{}')}
            onMount={(editor) => { editorRef.current = editor; }}
          />
        </Suspense>
      </div>

      {/* Trigger button */}
      <button
        className="contract-runner-btn contract-runner-btn--trigger"
        onClick={handleTrigger}
        disabled={!canTrigger}
        title={!contractState ? 'Initialize contract first' : 'Send request to contract logic'}
      >
        {isExecuting && contractState ? 'Executing...' : 'Send Request'}
      </button>

      {/* Logic error */}
      {logicError && (
        <div className="contract-runner-error">
          <span className="contract-runner-error-icon">⚠</span>
          <span className="contract-runner-error-text">{logicError}</span>
        </div>
      )}
    </div>
  );
}
