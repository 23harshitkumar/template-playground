import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMonaco } from '@monaco-editor/react';
import * as monacoNS from 'monaco-editor';
import useAppStore from '../store/store';
import { ACCORD_TYPE_STUBS, generateModelTypeStubs } from '../utils/logicTypeStubs';
import '../styles/components/LogicEditor.css';

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.Editor }))
);

const DEFAULT_LOGIC_BOILERPLATE = `// Write your contract logic here.
// TemplateLogic, IRequest, IState, IResponse are available as global types.

class ContractLogic extends TemplateLogic<any> {

  // Optional: initialize contract state
  async init(data: any) {
    return {
      state: {
        $identifier: 'contract-state',
        // add your initial state fields here
      },
    };
  }

  // Required: execute business logic for each request
  async trigger(data: any, request: any, state: any) {
    return {
      result: {
        $class: 'org.example.Response',
        $timestamp: new Date().toISOString(),
        // add your response fields here
      },
      state: {
        ...state,
        // update state fields here
      },
    };
  }
}

export default ContractLogic;
`;

export default function LogicEditor() {
  const monaco = useMonaco();
  const typeStubsRegistered = useRef(false);
  const modelStubDisposable = useRef<monacoNS.IDisposable | null>(null);

  const {
    editorLogicTs,
    logicTs,
    setEditorLogicTs,
    setLogicTs,
    modelCto,
    backgroundColor,
    showLineNumbers,
    isCompiling,
    compiledLogicJs,
    logicError,
  } = useAppStore((s) => ({
    editorLogicTs: s.editorLogicTs,
    logicTs: s.logicTs,
    setEditorLogicTs: s.setEditorLogicTs,
    setLogicTs: s.setLogicTs,
    modelCto: s.modelCto,
    backgroundColor: s.backgroundColor,
    showLineNumbers: s.showLineNumbers,
    isCompiling: s.isCompiling,
    compiledLogicJs: s.compiledLogicJs,
    logicError: s.logicError,
  }));

  const isDark = backgroundColor === '#121212';
  const themeName = isDark ? 'darkTheme' : 'lightTheme';

  // Register global Accord type stubs once Monaco is ready
  useEffect(() => {
    if (!monaco || typeStubsRegistered.current) return;
    typeStubsRegistered.current = true;

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      ACCORD_TYPE_STUBS,
      'accord-project-types.d.ts'
    );

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      strict: false,
      noEmit: true,
      allowNonTsExtensions: true,
    });
  }, [monaco]);

  // Re-generate model type stubs whenever the Concerto model changes
  useEffect(() => {
    if (!monaco || !modelCto) return;

    void generateModelTypeStubs(modelCto).then((stubs: string) => {
      if (!stubs) return;
      // Dispose previous model stubs before adding new ones
      modelStubDisposable.current?.dispose();
      modelStubDisposable.current =
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          stubs,
          'generated-model-types.d.ts'
        );
    });
  }, [monaco, modelCto]);

  const editorOptions: monacoNS.editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      wordWrap: 'on' as const,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      lineNumbers: showLineNumbers ? ('on' as const) : ('off' as const),
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'languageDefined' as const,
      quickSuggestions: { other: true, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
    }),
    [showLineNumbers]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      setEditorLogicTs(value ?? '');
    },
    [setEditorLogicTs]
  );

  const handleApply = useCallback(() => {
    void setLogicTs(editorLogicTs || DEFAULT_LOGIC_BOILERPLATE);
  }, [setLogicTs, editorLogicTs]);

  const statusText = isCompiling
    ? 'Compiling...'
    : compiledLogicJs && !logicError
    ? 'Compiled'
    : logicError
    ? 'Error'
    : 'Not compiled';

  const statusPrefix = compiledLogicJs && !logicError
    ? '✅ '
    : logicError
    ? '❌ '
    : '';

  const statusColor = isCompiling
    ? '#f59e0b'
    : compiledLogicJs && !logicError
    ? '#22c55e'
    : logicError
    ? '#ef4444'
    : '#9ca3af';

  // Has the editor content diverged from committed logic?
  const isDirty = editorLogicTs !== logicTs;

  return (
    <div className="logic-editor-root">
      <div className="logic-editor-toolbar">
        <span className="logic-editor-status" style={{ color: statusColor }}>
          {statusPrefix}{statusText}
        </span>
        <button
          className={`logic-editor-apply-btn${isDirty ? ' logic-editor-apply-btn--dirty' : ''}`}
          onClick={handleApply}
          disabled={isCompiling}
          title="Compile and apply logic (Ctrl+Enter)"
        >
          {isCompiling ? 'Compiling...' : isDirty ? 'Apply Logic*' : 'Apply Logic'}
        </button>
      </div>

      <div className="logic-editor-monaco-wrapper">
        <Suspense fallback={<div className="logic-editor-loading">Loading editor...</div>}>
          <MonacoEditor
            language="typescript"
            height="100%"
            value={editorLogicTs || DEFAULT_LOGIC_BOILERPLATE}
            theme={themeName}
            options={editorOptions}
            onChange={handleChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
