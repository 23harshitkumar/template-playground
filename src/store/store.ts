import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { debounce } from "ts-debounce";
import { ModelManager } from "@accordproject/concerto-core";
import { TemplateMarkInterpreter } from "@accordproject/template-engine";
import { TemplateMarkTransformer } from "@accordproject/markdown-template";
import { transform } from "@accordproject/markdown-transform";
import { SAMPLES, Sample } from "../samples";
import * as playground from "../samples/playground";
import { compress, decompress } from "../utils/compression/compression";
import { AIConfig, ChatState, KeyProtectionLevel } from '../types/components/AIAssistant.types';
import { validateBeforeRebuild, validateRuntimePayload } from "../utils/validators";
import { compileLogicTs } from "../utils/logicCompiler";
import type { CompileError } from "../utils/logicCompiler";

/** A single trigger execution result, stored in history */
export interface LogicExecutionResult {
  response: object;
  stateBefore: object;
  stateAfter: object;
  events: object[];
  executedAt: string; // ISO timestamp
}

interface AppState {
  // ── Existing template / model / data fields ────────────────────────────
  templateMarkdown: string;
  editorValue: string;
  modelCto: string;
  editorModelCto: string;
  data: string;
  editorAgreementData: string;
  agreementHtml: string;
  error: string | undefined;
  samples: Array<Sample>;
  sampleName: string;
  isAIConfigOpen: boolean;
  isAIChatOpen: boolean;
  backgroundColor: string;
  textColor: string;
  chatState: ChatState;
  aiConfig: AIConfig | null;
  chatAbortController: AbortController | null;

  // ── Logic / execution fields (NEW) ────────────────────────────────────
  /** Committed TypeScript logic source (triggers compilation) */
  logicTs: string;
  /** Live editor value — not committed until user clicks Apply */
  editorLogicTs: string;
  /** Compiled JavaScript ready for Worker execution (null = not compiled / error) */
  compiledLogicJs: string | null;
  /** Current initialized contract state (null = not yet initialized) */
  contractState: object | null;
  /** All past trigger execution results */
  executionHistory: LogicExecutionResult[];
  /** Most recent trigger result for display */
  latestExecution: LogicExecutionResult | null;
  /** True while TypeScript → JavaScript compilation is running */
  isCompiling: boolean;
  /** True while Worker is executing init() or trigger() */
  isExecuting: boolean;
  /** Compile or runtime error from logic — separate from template `error` */
  logicError: string | undefined;
  /** Compile errors with line info for Monaco markers */
  logicCompileErrors: CompileError[];

  // ── Existing action signatures ─────────────────────────────────────────
  setTemplateMarkdown: (template: string) => Promise<void>;
  setEditorValue: (value: string) => void;
  setModelCto: (model: string) => Promise<void>;
  setEditorModelCto: (value: string) => void;
  setData: (data: string) => Promise<void>;
  setEditorAgreementData: (value: string) => void;
  rebuild: () => Promise<void>;
  init: () => Promise<void>;
  loadSample: (name: string) => Promise<void>;
  generateShareableLink: () => string;
  loadFromLink: (compressedData: string) => Promise<void>;
  toggleDarkMode: () => void;
  setAIConfigOpen: (visible: boolean) => void;
  setAIChatOpen: (visible: boolean) => void;
  setChatState: (state: ChatState) => void;
  updateChatState: (partial: Partial<ChatState>) => void;
  setAIConfig: (config: AIConfig | null) => void;
  setChatAbortController: (controller: AbortController | null) => void;
  resetChat: () => void;
  isEditorsVisible: boolean;
  isPreviewVisible: boolean;
  isProblemPanelVisible: boolean;
  setEditorsVisible: (value: boolean) => void;
  setPreviewVisible: (value: boolean) => void;
  setProblemPanelVisible: (value: boolean) => void;
  startTour: () => void;
  isModelCollapsed: boolean;
  isTemplateCollapsed: boolean;
  isDataCollapsed: boolean;
  toggleModelCollapse: () => void;
  toggleTemplateCollapse: () => void;
  toggleDataCollapse: () => void;
  showLineNumbers: boolean;
  setShowLineNumbers: (value: boolean) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (value: boolean) => void;
  keyProtectionLevel: KeyProtectionLevel | null;
  setKeyProtectionLevel: (level: KeyProtectionLevel | null) => void;

  // ── Logic action signatures (NEW) ─────────────────────────────────────
  /** Update live editor value without compiling */
  setEditorLogicTs: (ts: string) => void;
  /** Commit logic — applies editorLogicTs, compiles to JS, resets execution state */
  setLogicTs: (ts: string) => Promise<void>;
  /** Spin up a Worker to call init() on the compiled logic */
  initContract: () => Promise<void>;
  /** Spin up a Worker to call trigger() with the given request JSON string */
  triggerContract: (requestJson: string) => Promise<void>;
  /** Clear execution history */
  clearExecutionHistory: () => void;
}

export interface DecompressedData {
  templateMarkdown: string;
  modelCto: string;
  data: string;
  agreementHtml: string;
}

// ── Module-level Worker management (outside Zustand — Workers aren't React state) ──
let activeLogicWorker: Worker | null = null;
let workerTimeout: ReturnType<typeof setTimeout> | null = null;

const WORKER_TIMEOUT_MS = 10_000; // kill runaway logic after 10 seconds

function terminateActiveWorker() {
  if (activeLogicWorker) {
    activeLogicWorker.terminate();
    activeLogicWorker = null;
  }
  if (workerTimeout !== null) {
    clearTimeout(workerTimeout);
    workerTimeout = null;
  }
}

const rebuildDeBounce = debounce(rebuild, 500);

async function rebuild(template: string, model: string, dataString: string): Promise<string> {
  // Validate inputs before expensive operations
  // This fails fast on invalid JSON or CTO syntax without running network calls
  await validateBeforeRebuild(template, model, dataString);
  
  const modelManager = new ModelManager({ strict: true });
  modelManager.addCTOModel(model, undefined, true);
  await modelManager.updateExternalModels();
  const engine = new TemplateMarkInterpreter(modelManager, {});
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const templateMarkTransformer = new TemplateMarkTransformer();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
    { content: template },
    modelManager,
    "contract",
    { verbose: false }
  ) as object;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data = JSON.parse(dataString);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
  const ciceroMark = await engine.generate(templateMarkDom, data);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const ciceroMarkJson = ciceroMark.toJSON() as unknown;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const result = await transform(
    ciceroMarkJson,
    "ciceromark_parsed",
    ["html"],
    {},
    { verbose: false }
  ) as string;
  return result;
}

const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      return { backgroundColor: '#121212', textColor: '#ffffff' };
    } else if (savedTheme === 'light') {
      return { backgroundColor: '#ffffff', textColor: '#121212' };
    }
  }
  // Default to light theme
  return { backgroundColor: '#ffffff', textColor: '#121212' };
};

/* --- Helper to safely load panel state --- */
const getInitialPanelState = () => {
  const defaults = {
    isEditorsVisible: true,
    isPreviewVisible: true,
    isProblemPanelVisible: false,
    isAIChatOpen: false,
  };
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ui-panels');
      if (saved) return { ...defaults, ...(JSON.parse(saved) as Partial<AppState>) };
    } catch (e) { /* ignore */ }
  }
  return defaults;
};

/* --- Helper to safely save panel state --- */
const savePanelState = (state: Partial<AppState>) => {
  if (typeof window !== 'undefined') {
    const panels = {
      isEditorsVisible: state.isEditorsVisible,
      isPreviewVisible: state.isPreviewVisible,
      isProblemPanelVisible: state.isProblemPanelVisible,
      isAIChatOpen: state.isAIChatOpen,
    };
    localStorage.setItem('ui-panels', JSON.stringify(panels));
  }
};

const getInitialLineNumbers = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('showLineNumbers');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return true; // Default to showing line numbers
};

const useAppStore = create<AppState>()(
  immer(
    devtools((set, get) => {
      const initialTheme = getInitialTheme();
      const initialPanels = getInitialPanelState(); // Load saved panels

      return {
        backgroundColor: initialTheme.backgroundColor,
        textColor: initialTheme.textColor,
        sampleName: playground.NAME,
        templateMarkdown: playground.TEMPLATE,
        editorValue: playground.TEMPLATE,
        modelCto: playground.MODEL,
        editorModelCto: playground.MODEL,
        data: JSON.stringify(playground.DATA, null, 2),
        editorAgreementData: JSON.stringify(playground.DATA, null, 2),
        agreementHtml: "",
        isAIConfigOpen: false,
        isAIChatOpen: initialPanels.isAIChatOpen,
        error: undefined,
        samples: SAMPLES,
        chatState: {
          messages: [],
          isLoading: false,
          error: null,
        },
        aiConfig: null,
        chatAbortController: null,
        isEditorsVisible: initialPanels.isEditorsVisible,
        isPreviewVisible: initialPanels.isPreviewVisible,
        isProblemPanelVisible: initialPanels.isProblemPanelVisible,
        isModelCollapsed: false,
        isTemplateCollapsed: false,
        isDataCollapsed: false,
        showLineNumbers: getInitialLineNumbers(),
        isSettingsOpen: false,
        keyProtectionLevel: null,
        // ── Logic initial state ────────────────────────────────────────────
        logicTs: '',
        editorLogicTs: '',
        compiledLogicJs: null,
        contractState: null,
        executionHistory: [],
        latestExecution: null,
        isCompiling: false,
        isExecuting: false,
        logicError: undefined,
        logicCompileErrors: [],

        toggleModelCollapse: () => set((state) => ({ isModelCollapsed: !state.isModelCollapsed })),
        toggleTemplateCollapse: () => set((state) => ({ isTemplateCollapsed: !state.isTemplateCollapsed })),
        toggleDataCollapse: () => set((state) => ({ isDataCollapsed: !state.isDataCollapsed })),
        setShowLineNumbers: (value: boolean) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('showLineNumbers', String(value));
          }
          set({ showLineNumbers: value });
        },
        setSettingsOpen: (value: boolean) => set({ isSettingsOpen: value }),
        setEditorsVisible: (value) => {
          const state = get();
          if (!value && !state.isPreviewVisible) {
            return;
          }
          set({ isEditorsVisible: value });
          savePanelState({ ...get(), isEditorsVisible: value }); // Save change
        },
        setPreviewVisible: (value) => {
          const state = get();
          if (!value && !state.isEditorsVisible) {
            return;
          }
          set({ isPreviewVisible: value });
          savePanelState({ ...get(), isPreviewVisible: value }); // Save change
        },
        setProblemPanelVisible: (value) => {
          set({ isProblemPanelVisible: value });
          savePanelState({ ...get(), isProblemPanelVisible: value }); // Save change
        },
        init: async () => {
          const params = new URLSearchParams(window.location.search);
          const compressedData = params.get("data");
          if (compressedData) {
            await get().loadFromLink(compressedData);
          } else {
            await get().rebuild();
          }
        },
        loadSample: async (name: string) => {
          const sample = SAMPLES.find((s) => s.NAME === name);
          if (sample) {
            const logicTs = sample.LOGIC ?? '';
            set(() => ({
              sampleName: sample.NAME,
              agreementHtml: undefined,
              error: undefined,
              templateMarkdown: sample.TEMPLATE,
              editorValue: sample.TEMPLATE,
              modelCto: sample.MODEL,
              editorModelCto: sample.MODEL,
              data: JSON.stringify(sample.DATA, null, 2),
              editorAgreementData: JSON.stringify(sample.DATA, null, 2),
              // Reset logic state when switching samples
              logicTs,
              editorLogicTs: logicTs,
              compiledLogicJs: null,
              contractState: null,
              executionHistory: [],
              latestExecution: null,
              logicError: undefined,
              logicCompileErrors: [],
              isCompiling: false,
              isExecuting: false,
            }));
            await get().rebuild();
            // Auto-compile if sample has logic
            if (logicTs) {
              await get().setLogicTs(logicTs);
            }
          }
        },

        rebuild: async () => {
          const { templateMarkdown, modelCto, data } = get();
          try {
            const result = await rebuildDeBounce(templateMarkdown, modelCto, data);
            set(() => ({ agreementHtml: result, error: undefined }));
          } catch (error: unknown) {
            set(() => ({
              error: formatError(error),
              isProblemPanelVisible: true,
            }));
          }
        },
        setTemplateMarkdown: async (template: string) => {
          set(() => ({ templateMarkdown: template }));
          const { modelCto, data } = get();
          try {
            const result = await rebuildDeBounce(template, modelCto, data);
            set(() => ({ agreementHtml: result, error: undefined }));
          } catch (error: unknown) {
            set(() => ({
              error: formatError(error),
              isProblemPanelVisible: true,
            }));
          }
        },
        setEditorValue: (value: string) => {
          set(() => ({ editorValue: value }));
        },
        setModelCto: async (model: string) => {
          set(() => ({ modelCto: model }));
          const { templateMarkdown, data } = get();
          try {
            const result = await rebuildDeBounce(templateMarkdown, model, data);
            set(() => ({ agreementHtml: result, error: undefined }));
          } catch (error: unknown) {
            set(() => ({
              error: formatError(error),
              isProblemPanelVisible: true,
            }));
          }
        },
        setEditorModelCto: (value: string) => {
          set(() => ({ editorModelCto: value }));
        },
        setData: async (data: string) => {
          set(() => ({ data }));
          try {
            const result = await rebuildDeBounce(
              get().templateMarkdown,
              get().modelCto,
              data
            );
            set(() => ({ agreementHtml: result, error: undefined }));
          } catch (error: unknown) {
            set(() => ({
              error: formatError(error),
              isProblemPanelVisible: true,
            }));
          }

        },
        setEditorAgreementData: (value: string) => {
          set(() => ({ editorAgreementData: value }));
        },
        generateShareableLink: () => {
          const state = get();
          const compressedData = compress({
            templateMarkdown: state.templateMarkdown,
            modelCto: state.modelCto,
            data: state.data,
            agreementHtml: state.agreementHtml,
          });
          return `${window.location.origin}/#data=${compressedData}`;
        },
        loadFromLink: async (compressedData: string) => {
          try {
            const { templateMarkdown, modelCto, data, agreementHtml } = decompress(compressedData);
            if (!templateMarkdown || !modelCto || !data) {
              throw new Error("Invalid share link data");
            }
            set(() => ({
              templateMarkdown,
              editorValue: templateMarkdown,
              modelCto,
              editorModelCto: modelCto,
              data,
              editorAgreementData: data,
              agreementHtml,
              error: undefined,
            }));
            await get().rebuild();
          } catch (error) {
            set(() => ({
              error: "Failed to load shared content: " + (error instanceof Error ? error.message : "Unknown error"),
              isProblemPanelVisible: true,
            }));
          }
        },
        toggleDarkMode: () => {
          set((state) => {
            const isDark = state.backgroundColor === '#121212';
            const newTheme = {
              backgroundColor: isDark ? '#ffffff' : '#121212',
              textColor: isDark ? '#121212' : '#ffffff',
            };

            if (typeof window !== 'undefined') {
              const themeValue = isDark ? 'light' : 'dark';
              localStorage.setItem('theme', themeValue);
              try {
                document.documentElement.setAttribute('data-theme', themeValue);
              } catch (e) {
                // ignore
              }
            }

            return newTheme;
          });
        },
        setAIConfigOpen: (isOpen: boolean) => set(() => ({ isAIConfigOpen: isOpen })),
        setAIChatOpen: (isOpen: boolean) => {
          set(() => ({ isAIChatOpen: isOpen }));
          savePanelState({ ...get(), isAIChatOpen: isOpen }); // Save change
        },
        setChatState: (state) => set({ chatState: state }),
        updateChatState: (partial) => set((state) => ({
          chatState: { ...state.chatState, ...partial }
        })),
        setAIConfig: (config) => set({ aiConfig: config }),
        setChatAbortController: (controller) => set({ chatAbortController: controller }),
        setKeyProtectionLevel: (level) => set({ keyProtectionLevel: level }),
        resetChat: () => {
          const { chatAbortController } = get();
          if (chatAbortController) {
            chatAbortController.abort();
          }
          get().setChatState({
            messages: [],
            isLoading: false,
            error: null,
          });
        },
        startTour: () => {
          console.log('Starting tour...');
        },

        // ── Logic actions (NEW) ────────────────────────────────────────────

        setEditorLogicTs: (ts: string) => {
          set(() => ({ editorLogicTs: ts }));
        },

        setLogicTs: async (ts: string) => {
          terminateActiveWorker();
          set(() => ({
            logicTs: ts,
            editorLogicTs: ts,
            isCompiling: true,
            logicError: undefined,
            logicCompileErrors: [],
            // Reset execution state whenever logic changes
            contractState: null,
            executionHistory: [],
            latestExecution: null,
          }));
          try {
            const result = await compileLogicTs(ts);
            if (result.hasError) {
              set(() => ({
                compiledLogicJs: null,
                isCompiling: false,
                logicError: result.errors
                  .map((e) => `Logic: ${e.message}${e.line ? ` (line ${e.line})` : ''}`)
                  .join('\n'),
                logicCompileErrors: result.errors,
                isProblemPanelVisible: true,
              }));
            } else {
              set(() => ({
                compiledLogicJs: result.jsCode,
                isCompiling: false,
                logicError: undefined,
                logicCompileErrors: [],
              }));
            }
          } catch (err: unknown) {
            set(() => ({
              compiledLogicJs: null,
              isCompiling: false,
              logicError: formatError(err),
              isProblemPanelVisible: true,
            }));
          }
        },

        initContract: async () => {
          const { compiledLogicJs, data, modelCto } = get();
          if (!compiledLogicJs) {
            set(() => ({
              logicError: 'Logic has compile errors. Fix them before initializing.',
              isProblemPanelVisible: true,
            }));
            return;
          }
          let contractData: object;
          try {
            contractData = JSON.parse(data) as object;
          } catch {
            set(() => ({
              logicError: 'JSON Data is invalid. Fix it before initializing.',
              isProblemPanelVisible: true,
            }));
            return;
          }

          terminateActiveWorker();
          set(() => ({ isExecuting: true, logicError: undefined }));

          return new Promise<void>((resolve) => {
            let worker: Worker;
            try {
              worker = new Worker(
                new URL('../workers/logicWorker.ts', import.meta.url),
                { type: 'module' }
              );
            } catch (workerCreateError: unknown) {
              set(() => ({
                isExecuting: false,
                logicError: `Worker failed to start during init: ${formatError(workerCreateError)}`,
                isProblemPanelVisible: true,
              }));
              resolve();
              return;
            }
            activeLogicWorker = worker;

            workerTimeout = setTimeout(() => {
              terminateActiveWorker();
              set(() => ({
                isExecuting: false,
                logicError: 'Init timed out after 10 seconds. Check for infinite loops in your logic.',
                isProblemPanelVisible: true,
              }));
              resolve();
            }, WORKER_TIMEOUT_MS);

            worker.onmessage = async (event: MessageEvent) => {
              terminateActiveWorker();
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const msg = event.data as { type: string; action: string; state?: object; events?: object[]; message?: string };
              if (msg.type === 'success') {
                const nextState = msg.state ?? {};
                try {
                  await validateRuntimePayload({
                    model: modelCto,
                    state: nextState,
                    events: msg.events ?? [],
                  });
                } catch (validationError: unknown) {
                  set(() => ({
                    isExecuting: false,
                    logicError: `Init produced invalid runtime payload: ${formatError(validationError)}`,
                    isProblemPanelVisible: true,
                  }));
                  resolve();
                  return;
                }

                set(() => ({
                  contractState: nextState,
                  isExecuting: false,
                  logicError: undefined,
                }));
              } else {
                set(() => ({
                  isExecuting: false,
                  logicError: `Init failed: ${msg.message ?? 'Unknown error'}`,
                  isProblemPanelVisible: true,
                }));
              }
              resolve();
            };

            worker.onerror = (err) => {
              terminateActiveWorker();
              const errMsg = err.message
                ? err.message
                : `Worker failed to load (${err.filename ?? 'unknown'}:${err.lineno ?? '?'})`;
              set(() => ({
                isExecuting: false,
                logicError: `Worker error during init: ${errMsg}`,
                isProblemPanelVisible: true,
              }));
              resolve();
            };

            try {
              worker.postMessage({
                action: 'init',
                modelCto,
                logicJs: compiledLogicJs,
                contractData,
              });
            } catch (postMessageError: unknown) {
              terminateActiveWorker();
              set(() => ({
                isExecuting: false,
                logicError: `Worker postMessage failed during init: ${formatError(postMessageError)}`,
                isProblemPanelVisible: true,
              }));
              resolve();
            }
          });
        },

        triggerContract: async (requestJson: string) => {
          const { compiledLogicJs, data, contractState, modelCto } = get();
          if (!compiledLogicJs) {
            set(() => ({
              logicError: 'Logic has compile errors. Please fix them first.',
              isProblemPanelVisible: true,
            }));
            return;
          }
          if (!contractState) {
            set(() => ({
              logicError: 'Contract must be initialized first. Click "Init Contract".',
              isProblemPanelVisible: true,
            }));
            return;
          }

          let contractData: object;
          let request: object;
          try {
            contractData = JSON.parse(data) as object;
          } catch {
            set(() => ({
              logicError: 'JSON Data is invalid.',
              isProblemPanelVisible: true,
            }));
            return;
          }
          try {
            request = JSON.parse(requestJson) as object;
          } catch {
            set(() => ({
              logicError: 'Request JSON is invalid. Please enter valid JSON.',
              isProblemPanelVisible: true,
            }));
            return;
          }

          try {
            await validateRuntimePayload({ model: modelCto, request, state: contractState });
          } catch (validationError: unknown) {
            set(() => ({
              logicError: `Invalid request/state runtime payload: ${formatError(validationError)}`,
              isProblemPanelVisible: true,
            }));
            return;
          }

          const stateBefore = contractState;
          terminateActiveWorker();
          set(() => ({ isExecuting: true, logicError: undefined }));

          return new Promise<void>((resolve) => {
            let worker: Worker;
            try {
              worker = new Worker(
                new URL('../workers/logicWorker.ts', import.meta.url),
                { type: 'module' }
              );
            } catch (workerCreateError: unknown) {
              set(() => ({
                isExecuting: false,
                logicError: `Worker failed to start during trigger: ${formatError(workerCreateError)}`,
                isProblemPanelVisible: true,
              }));
              resolve();
              return;
            }
            activeLogicWorker = worker;

            workerTimeout = setTimeout(() => {
              terminateActiveWorker();
              set(() => ({
                isExecuting: false,
                logicError: 'Trigger timed out after 10 seconds. Check for infinite loops in your logic.',
                isProblemPanelVisible: true,
              }));
              resolve();
            }, WORKER_TIMEOUT_MS);

            worker.onmessage = async (event: MessageEvent) => {
              terminateActiveWorker();
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const msg = event.data as { type: string; action: string; result?: object; response?: object; state?: object; events?: object[]; message?: string };
              if (msg.type === 'success') {
                const nextState = msg.state ?? stateBefore;
                const nextResponse = msg.response ?? msg.result ?? {};
                const nextEvents = msg.events ?? [];

                try {
                  await validateRuntimePayload({
                    model: modelCto,
                    response: nextResponse,
                    state: nextState,
                    events: nextEvents,
                  });
                } catch (validationError: unknown) {
                  set(() => ({
                    isExecuting: false,
                    logicError: `Trigger produced invalid runtime payload: ${formatError(validationError)}`,
                    isProblemPanelVisible: true,
                  }));
                  resolve();
                  return;
                }

                const execution: LogicExecutionResult = {
                  response: nextResponse,
                  stateBefore,
                  stateAfter: nextState,
                  events: nextEvents,
                  executedAt: new Date().toISOString(),
                };
                set((state) => ({
                  contractState: nextState,
                  latestExecution: execution,
                  executionHistory: [...state.executionHistory, execution],
                  isExecuting: false,
                  logicError: undefined,
                }));
              } else {
                set(() => ({
                  isExecuting: false,
                  logicError: `Trigger failed: ${msg.message ?? 'Unknown error'}`,
                  isProblemPanelVisible: true,
                }));
              }
              resolve();
            };

            worker.onerror = (err) => {
              terminateActiveWorker();
              const errMsg = err.message
                ? err.message
                : `Worker failed to load (${err.filename ?? 'unknown'}:${err.lineno ?? '?'})`;
              set(() => ({
                isExecuting: false,
                logicError: `Worker error during trigger: ${errMsg}`,
                isProblemPanelVisible: true,
              }));
              resolve();
            };

            try {
              worker.postMessage({
                action: 'trigger',
                modelCto,
                logicJs: compiledLogicJs,
                contractData,
                request,
                state: stateBefore,
              });
            } catch (postMessageError: unknown) {
              terminateActiveWorker();
              set(() => ({
                isExecuting: false,
                logicError: `Worker postMessage failed during trigger: ${formatError(postMessageError)}`,
                isProblemPanelVisible: true,
              }));
              resolve();
            }
          });
        },

        clearExecutionHistory: () => {
          set(() => ({ executionHistory: [], latestExecution: null }));
        },
      }
    })
  )
);


export default useAppStore;

function formatError(error: unknown): string {
  console.error(error);
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return error.map((e) => formatError(e)).join("\n");
  if (error && typeof error === "object" && "code" in error) {
    const errorObj = error as { code?: unknown; errors?: unknown; renderedMessage?: unknown };
    const sub = errorObj.errors ? formatError(errorObj.errors) : "";
    const msg = String(errorObj.renderedMessage ?? "");
    return `Error: ${String(errorObj.code ?? "")} ${sub} ${msg}`;
  }
  return String(error);
}
