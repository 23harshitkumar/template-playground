<!--
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0
-->

# Video Production Guide: Accord Project Template Logic Overview

- **Title**: Authoring & Executing Smart Legal Contract Logic in the Accord Project Playground
- **Target Duration**: 4 minutes 30 seconds
- **Target Audience**: Template Authors, Legal Engineers, and Platform Contributors
- **Resolution**: 1920 x 1080 (1080p60)

---

## Storyboard & Scene Breakdown

### Scene 1: Introduction & Concepts (0:00 – 0:45)
- **Visual**: Full-screen shot of the Accord Project Template Playground homepage (`https://playground.accordproject.org`).
- **Cursor Action**: Smooth pan across the top Navbar highlighting the **Samples** dropdown and **Simulate** tab.
- **On-Screen Text Overlay**: *"Accord Project: Smart Legal Contract Logic"*
- **Voiceover**: 
  > *"Welcome to the Accord Project Template Playground! In this video, we'll explore how to author, compile, and execute smart legal contract logic directly in your browser. A complete smart contract combines three key elements: a Concerto data model, TemplateMark agreement text, and executable TypeScript logic extending `TemplateLogic`. Let me show you how it works."*

---

### Scene 2: Exploring the Interface (0:45 – 1:30)
- **Visual**: Zoom in on the left panel containing the **Concerto Model**, **TemplateMark**, and **Logic Editor** tabs, then pan to the right panel containing the **Contract Runner**.
- **Cursor Action**: Click on the **Logic Editor** tab, then hover over the **Apply & Compile** button. Click the **Contract Runner** panel on the right.
- **On-Screen Text Overlay**: *"Monaco Logic Editor + Secure Web Worker Sandbox"*
- **Voiceover**:
  > *"When you open a logic-enabled template, the left panel presents the Logic Editor powered by Monaco. Here you can write TypeScript logic with rich inline autocompletion. On the right, the Contract Runner panel lets you edit transaction requests, initialize contract state, and view execution outputs in real time."*

---

### Scene 3: Live Demo — Compiling & Initializing (1:30 – 2:45)
- **Visual**: Select **Counter Contract** from the **Samples** dropdown menu.
- **Cursor Action**:
  1. Open **Logic Editor**. Show the `init()` and `trigger()` methods.
  2. Change `counter + 1` to `counter + 1`. Click **Apply & Compile**.
  3. Show the green success badge.
  4. Pan to right panel and click **Init Contract**.
  5. Click the **State** tab to reveal `{ "counter": 0 }`.
- **On-Screen Text Overlay**: *"Step 1: Compile. Step 2: Init State."*
- **Voiceover**:
  > *"Let's load the Counter Contract sample. In the Logic Editor, our class extends `TemplateLogic`. Clicking 'Apply & Compile' compiles the TypeScript into executable JavaScript. Now, over in the Contract Runner, we click 'Init Contract'. The contract runs inside an isolated Web Worker sandbox and sets our initial state counter to zero."*

---

### Scene 4: Executing Requests & Inspecting Results (2:45 – 3:45)
- **Visual**: Focus on the **Request JSON** editor and action buttons.
- **Cursor Action**:
  1. Highlight the `CounterRequest` JSON.
  2. Click **Send Request**.
  3. Show the **State** tab update from `0` to `1`.
  4. Click **Send Request** a second time; show state update from `1` to `2`.
  5. Click the **Response** tab, **Events** tab, and **History** log tab sequentially.
- **On-Screen Text Overlay**: *"Stateful Transaction Execution & Event Emission"*
- **Voiceover**:
  > *"Now let's trigger the contract! We click 'Send Request' to dispatch a transaction. The logic's `trigger()` method evaluates the request, updates the counter state to 1, and emits a business event. Clicking 'Send Request' again increments the state to 2. You can review the complete execution log and state history under the History tab."*

---

### Scene 5: Late Payment Clause & Wrap-Up (3:45 – 4:30)
- **Visual**: Switch sample to **Late Payment Clause**.
- **Cursor Action**: Show the penalty calculation logic in the editor, click **Init Contract**, then click **Send Request** with an overdue date. Show penalty response payload.
- **On-Screen Text Overlay**: *"Calculates Overdue Penalty Fees automatically."*
- **Voiceover**:
  > *"The same workflow applies to complex legal agreements like the Late Payment Clause or SLAs. Here, the contract automatically calculates interest penalties when payment dates exceed terms. Try out the sample templates today in the Template Playground!"*

---

## Video Publishing & Embedding Checklist

1. Record video at 1080p60 with crisp typography.
2. Export as MP4 (H.264, AAC audio).
3. Upload to YouTube/Loom under the Accord Project channel.
4. Replace `https://www.youtube.com/embed/YOUR_VIDEO_ID` in `docs/tutorial-template-logic.md` with the published URL.
