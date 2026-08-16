<!--
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0
-->

---
id: tutorial-template-logic
title: Authoring and Executing Smart Legal Contract Logic in Template Playground
sidebar_label: Template Logic Tutorial
description: Step-by-step tutorial on authoring, compiling, initializing, and triggering smart contract logic in the Accord Project Template Playground.
---

# Authoring & Executing Template Logic in the Playground

Welcome to the **Template Logic Tutorial**! This guide walks **Template Authors** through authoring, compiling, and executing smart contract logic in the [Accord Project Template Playground](https://playground.accordproject.org).

By the end of this tutorial, you will understand how to:
1. Load logic-enabled contract templates.
2. Write TypeScript contract logic extending `TemplateLogic`.
3. Compile logic and resolve syntax/type diagnostics in real-time.
4. Initialize contract state (`Init Contract`).
5. Execute contract requests (`Send Request`) and inspect response payloads, updated contract state, and emitted events.

---

## Companion Video Overview

Watch this 4-minute overview video demonstrating the complete end-to-end workflow in the Template Playground:

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin-bottom: 2rem;">
  <iframe 
    src="https://www.youtube.com/embed/YOUR_VIDEO_ID" 
    title="Accord Project Template Logic Overview"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>

---

## 1. What is Template Logic?

Smart legal contracts combine three core components:
- **Concerto Data Model (`.cto`)**: Defines the data structures, concepts, requests, responses, and state models.
- **TemplateMark Grammar (`.tem.md`)**: Defines the natural language legal agreement text with embedded variables.
- **Template Logic (`.ts`)**: Defines the executable business logic that governs how the contract responds to external events and modifies its internal state over time.

In the Accord Project framework, contract logic is written in TypeScript as a class extending `TemplateLogic<T>`:

```typescript
import { TemplateLogic, InitResponse, TriggerResponse } from '@accordproject/template-engine';

export default class ContractLogic extends TemplateLogic<ContractData> {
  /**
   * Called once when the contract is deployed or initialized.
   * Sets up the starting state of the contract.
   */
  async init(data: ContractData): Promise<InitResponse> {
    return {
      state: { counter: 0 }
    };
  }

  /**
   * Called whenever an external event or transaction request is sent to the contract.
   * Computes the new state, returns a response payload, and optionally emits events.
   */
  async trigger(data: ContractData, request: RequestPayload, state: ContractState): Promise<TriggerResponse> {
    const newCounter = (state.counter || 0) + 1;
    return {
      response: { status: "SUCCESS", counter: newCounter },
      state: { counter: newCounter },
      events: [{ $class: "org.example.CounterIncremented", value: newCounter }]
    };
  }
}
```

---

## 2. Interactive Playground UI Map

When you open the Template Playground, the interface is split into distinct functional areas designed for authoring and execution:

```
+-----------------------------------------------------------------------------------+
|  NAVBAR: Samples Dropdown | Help Menu | Learn Button | Dark Mode | Share Link    |
+-----------------------------------------------------------------------------------+
|  TAB NAVIGATION: [ Build (Drafting) ]   [ Simulate (Contract Runner & Logic) ]    |
+----------------------------------------+------------------------------------------+
|  LEFT PANEL: EDITORS                   | RIGHT PANEL: RUNNER & PREVIEW            |
|  +-----------------------------------+ | +--------------------------------------+ |
|  | Concerto Model (.cto)             | | | Contract Request JSON Editor           | |
|  +-----------------------------------+ | | [ Init Contract ]  [ Send Request ]   | |
|  | TemplateMark (.tem.md)            | | +--------------------------------------+ |
|  | Logic Editor (TypeScript .ts)     | | | Execution Output Tabs:               | |
|  | [ Apply & Compile ]               | | | - Response JSON                      | |
|  +-----------------------------------+ | | - Contract State JSON                | |
|  | JSON Data                         | | | - Emitted Events                     | |
|  +-----------------------------------+ | | - Execution History                  | |
|  |                                   | | +--------------------------------------+ |
+----------------------------------------+------------------------------------------+
|  BOTTOM PANEL: Problems & Compiler Error Diagnostics                              |
+-----------------------------------------------------------------------------------+
```

---

## 3. Sample Templates Walkthrough

The Template Playground includes built-in logic-enabled sample templates to help you get started quickly:

### Sample A: Counter Contract
- **Goal**: Demonstrates state persistence and monotonic state increments.
- **Workflow**:
  - `init()` sets `state.counter = 0`.
  - `trigger()` increments `state.counter` by `1` and emits a `CounterIncremented` event.

### Sample B: Late Payment Clause
- **Goal**: Calculates penalty interest when payment is received after the agreed due date.
- **Workflow**:
  - `init()` sets `state.penaltyTotal = 0`.
  - `trigger()` accepts a `PaymentReceived` request with payment date.
  - If payment is overdue, calculates penalty: `penalty = overdueDays * dailyInterestRate`.
  - Updates `state.penaltyTotal` and returns a `PaymentResponse` payload.

### Sample C: Service Level Agreement (SLA)
- **Goal**: Evaluates monthly service uptime against guaranteed SLAs.
- **Workflow**:
  - `trigger()` accepts a `MonthlyReport` request.
  - If uptime is below target (e.g., < 99.9%), calculates credit refund owed to client.
  - Emits an `SLAViolatedEvent`.

---

## 4. Step-by-Step Logic Authoring & Execution Workflow

Follow these 6 steps to create and test contract logic in the Playground:

### Step 1: Load a Logic Sample Template
1. Click the **Samples** dropdown in the top Navbar.
2. Select **Counter Contract** (or **Late Payment Clause**).
3. Notice that the **Logic Editor** tab opens on the left panel containing pre-written TypeScript code.

### Step 2: Edit the TypeScript Logic
1. Navigate to the **Logic Editor** tab.
2. Edit the code (for example, change the counter increment step from `+ 1` to `+ 5`).
3. Notice the inline Monaco autocompletion for `TemplateLogic`, `InitResponse`, and `TriggerResponse`.

### Step 3: Compile Logic (`Apply & Compile`)
1. Click the **Apply & Compile** button at the top right of the Logic Editor.
2. If there are syntax or type errors, red squiggly lines will appear in the editor, and detailed error messages will display in the **Problems Panel** at the bottom.
3. Fix any errors until compilation succeeds (indicated by a green success badge).

### Step 4: Initialize Contract State (`Init Contract`)
1. In the right panel, navigate to the **Contract Runner** panel.
2. Click **Init Contract**.
3. The logic's `init()` method executes in an isolated Web Worker sandbox.
4. Check the **State** tab: it displays `{ "counter": 0 }`.

### Step 5: Send a Contract Request (`Send Request`)
1. In the **Request JSON** editor, inspect the sample payload:
   ```json
   {
     "$class": "org.accordproject.counter.CounterRequest"
   }
   ```
2. Click **Send Request**.
3. The logic's `trigger()` method executes with the current data, request, and state.

### Step 6: Inspect Results
Switch between the tabs in the Contract Runner panel:
- **Response**: View the returned payload (e.g. `{ "$class": "org.accordproject.counter.CounterResponse", "status": "SUCCESS" }`).
- **State**: Observe the updated contract state (counter incremented to `1`, then `2` on subsequent triggers).
- **Events**: View real-time emitted business events.
- **History**: View the chronological log of all executed transactions and state diffs.

---

## 5. Troubleshooting & Common Pitfalls

| Issue | Cause | Solution |
| --- | --- | --- |
| **"Cannot find name 'TemplateLogic'"** | Missing base class import | Ensure `import { TemplateLogic } from '@accordproject/template-engine'` is at top of file. |
| **Red error underline in Monaco** | TypeScript type mismatch | Check that the return object contains required keys (`state` for init; `response` and `state` for trigger). |
| **"Compilation Failed" in Problem Panel** | Syntax error in TS code | Inspect line and column numbers reported in the Problems panel at the bottom. |
| **Execution Timeout (5000ms)** | Infinite loop in contract logic | Review `while` or `for` loops in your code to ensure termination criteria. |

---

## Next Steps & Resources

- Learn more about the Accord Project framework at [docs.accordproject.org](https://docs.accordproject.org).
- Explore the data modeling specification at [concerto.accordproject.org](https://concerto.accordproject.org).
- Join the community on [Discord](https://discord.com/invite/Zm99SKhhtA) to share templates and ask questions!
