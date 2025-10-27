# Test Generation Flow - Visual Diagrams

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LANDING SCREEN                               │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │
│  │  Generate     │  │  Write Tests  │  │  Use Template │          │
│  │  with AI      │  │  Manually     │  │  Library      │          │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘          │
│          │                   │                   │                   │
└──────────┼───────────────────┼───────────────────┼──────────────────┘
           │                   │                   │
           │                   │                   │
           v                   v                   v
    ┌──────────────┐    ┌──────────────┐   ┌──────────────┐
    │ INPUT SCREEN │    │  Navigate to │   │ INTERFACE    │
    │              │    │  /new-manual │   │ (Pre-filled) │
    │ - Describe   │    │              │   │              │
    │ - Endpoint   │    └──────────────┘   └──────┬───────┘
    │ - Upload     │                               │
    └──────┬───────┘                              │
           │                                       │
           v                                       │
    ┌──────────────┐                              │
    │ INTERFACE    │◄─────────────────────────────┘
    │              │
    │ 2-Panel View │
    │ - Config     │
    │ - Preview    │
    │ - Responses  │
    │ - Chat       │
    └──────┬───────┘
           │
           v
    ┌──────────────┐
    │ CONFIRMATION │
    │              │
    │ - Summary    │
    │ - Size       │
    │ - Name       │
    └──────┬───────┘
           │
           v
    ┌──────────────┐
    │   GENERATE   │
    │   (Backend)  │
    └──────────────┘
```

## Component Hierarchy

```
<TestGenerationFlow>
  │
  ├─ currentScreen === 'landing'
  │   └─ <LandingScreen>
  │       ├─ <Grid> (Action Cards)
  │       │   ├─ <Card> AI Generation
  │       │   └─ <Card> Manual Writing
  │       └─ <Grid> (Template Library)
  │           └─ <Card>[] Template Cards
  │
  ├─ currentScreen === 'input'
  │   └─ <TestInputScreen>
  │       ├─ <TextField> Description
  │       ├─ <Chip>[] Suggestions
  │       ├─ <EndpointSelector> (Optional)
  │       └─ <DocumentUpload>
  │
  ├─ currentScreen === 'interface'
  │   └─ <TestGenerationInterface>
  │       ├─ <Box> Left Panel (33%)
  │       │   ├─ <CardHeader>
  │       │   ├─ <ScrollArea>
  │       │   │   ├─ <ChipGroup> Behavior
  │       │   │   ├─ <ChipGroup> Topics
  │       │   │   ├─ <ChipGroup> Category
  │       │   │   └─ <ChipGroup> Scenarios
  │       │   ├─ <Box> Uploaded Files
  │       │   └─ <Paper> Chat Input
  │       │       ├─ <IconButton> Add
  │       │       ├─ <TextField> Input
  │       │       └─ <IconButton> Send
  │       ├─ <Box> Right Panel (67%)
  │       │   ├─ <CardHeader>
  │       │   ├─ <Box> Endpoint Info Banner (if endpoint selected)
  │       │   └─ <ScrollArea>
  │       │       └─ <TestSampleCard>[]
  │       │           ├─ Prompt (left aligned)
  │       │           ├─ Response (right aligned, live from endpoint)
  │       │           └─ Rating buttons
  │       └─ <Box> Action Bar
  │           ├─ <Button> Back
  │           └─ <Button> Generate
  │
  └─ currentScreen === 'confirmation'
      └─ <TestConfigurationConfirmation>
          ├─ <Box> Test Set Naming
          ├─ <Grid>
          │   ├─ <Card> Summary
          │   │   ├─ Behavior Chips
          │   │   ├─ Topic Chips
          │   │   ├─ Category Chips
          │   │   └─ Scenario Chips
          │   └─ <Card> Size Selection
          │       └─ <TestSetSizeSelector>
          └─ <Box> Action Bar
              ├─ <Button> Back
              └─ <Button> Generate
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TestGenerationFlow (State)                      │
│                                                                      │
│  State:                                                              │
│  - currentScreen                                                     │
│  - mode                                                              │
│  - description                                                       │
│  - uploadedFiles                                                     │
│  - selectedEndpointId                                                │
│  - project                                                           │
│  - configChips                                                       │
│  - documents                                                         │
│  - testSamples (with responses from endpoint)                        │
│  - testSetSize                                                       │
│  - testSetName                                                       │
└─────────────┬───────────────────────────────────────────────────────┘
              │
              │  Props flow down
              │
    ┌─────────┼─────────┐
    │         │         │
    v         v         v
┌────────┐ ┌────────┐ ┌────────┐
│Landing │ │ Input  │ │Interface
│ Screen │ │ Screen │ │        │
└────┬───┘ └───┬────┘ └───┬────┘
     │         │           │
     │         │           │  Events bubble up
     │         │           │
     └─────────┴───────────┘
                │
                v
        ┌───────────────┐
        │  Event Handler│
        │  in Flow      │
        └───────┬───────┘
                │
                v
        ┌───────────────┐
        │  Update State │
        └───────┬───────┘
                │
                v
        ┌───────────────┐
        │  Re-render    │
        │  with new data│
        └───────────────┘
```

## API Call Sequence

```
User Action: Upload Document
     │
     v
┌────────────────────────────────┐
│ 1. ServicesClient              │
│    .uploadDocument(file)       │
└────────┬───────────────────────┘
         │
         v  Returns: { path: string }
┌────────────────────────────────┐
│ 2. ServicesClient              │
│    .extractDocument(path)      │
└────────┬───────────────────────┘
         │
         v  Returns: { content: string }
┌────────────────────────────────┐
│ 3. ServicesClient              │
│    .generateDocumentMetadata() │
└────────┬───────────────────────┘
         │
         v  Returns: { name, description }
┌────────────────────────────────┐
│ Update UI with processed doc   │
└────────────────────────────────┘


User Action: Generate Samples
     │
     v
┌────────────────────────────────┐
│ 1. Build prompt from config    │
│    - configChips → behaviors   │
│    - description → context     │
│    - documents → context       │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 2. ServicesClient              │
│    .generateTests({            │
│      prompt,                   │
│      num_tests: 5,             │
│      documents                 │
│    })                          │
└────────┬───────────────────────┘
         │
         v  Returns: { tests: [...] }
┌────────────────────────────────┐
│ 3. Map tests to UI samples     │
│    - Extract prompt & response │
│    - Add rating placeholders   │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 4. Display in TestSampleCard   │
└────────┬───────────────────────┘
         │
         │  If endpoint selected
         v
┌────────────────────────────────┐
│ 5. For each sample:            │
│    EndpointsClient             │
│    .invokeEndpoint(id, {       │
│      input: sample.prompt      │
│    })                          │
└────────┬───────────────────────┘
         │
         v  Returns: { output: "..." }
┌────────────────────────────────┐
│ 6. Update sample with response │
│    - Show loading state        │
│    - Display live response     │
│    - Handle errors gracefully  │
└────────────────────────────────┘


User Action: Final Generation
     │
     v
┌────────────────────────────────┐
│ 1. Build generation config     │
│    - Map chips to behaviors    │
│    - Add test set size         │
│    - Add samples with ratings  │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 2. TestSetsClient              │
│    .generateTestSet({          │
│      config,                   │
│      samples,                  │
│      synthesizer_type          │
│    })                          │
└────────┬───────────────────────┘
         │
         v  Returns: { task_id, message }
┌────────────────────────────────┐
│ 3. Show success notification   │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 4. Navigate to /tests          │
└────────────────────────────────┘
```

## State Transitions

```
Initial State:
┌──────────────────────────────┐
│ currentScreen: 'landing'     │
│ mode: null                   │
│ description: ''              │
│ configChips: all inactive    │
│ testSamples: []              │
└──────────────────────────────┘

User clicks "Generate with AI":
┌──────────────────────────────┐
│ currentScreen: 'input'       │
│ mode: 'ai'                   │
│ description: ''              │
│ uploadedFiles: []            │
└──────────────────────────────┘

User enters description, selects endpoint, and clicks Continue:
┌──────────────────────────────┐
│ currentScreen: 'interface'   │
│ mode: 'ai'                   │
│ description: 'user input...' │
│ selectedEndpointId: 'xyz'    │
│ uploadedFiles: [...]         │
│ isGenerating: true           │
└──────────────────────────────┘

After initial generation:
┌──────────────────────────────┐
│ currentScreen: 'interface'   │
│ testSamples: [5 samples]     │
│ isGenerating: false          │
│ configChips: some active     │
│ endpointInfo: loaded         │
└──────────────────────────────┘

Fetching endpoint responses:
┌──────────────────────────────┐
│ testSamples[0]:              │
│   isLoadingResponse: true    │
│ ↓ API call to endpoint       │
│ testSamples[0]:              │
│   response: 'endpoint reply' │
│   isLoadingResponse: false   │
└──────────────────────────────┘

User toggles chips, refines via chat:
┌──────────────────────────────┐
│ configChips: updated         │
│ chatMessages: [...]          │
│ testSamples: refreshed       │
└──────────────────────────────┘

User clicks "Generate Tests":
┌──────────────────────────────┐
│ currentScreen: 'confirmation'│
│ testSetSize: 'medium'        │
│ testSetName: ''              │
└──────────────────────────────┘

User confirms generation:
┌──────────────────────────────┐
│ isGenerating: true           │
│ ↓                            │
│ API call                     │
│ ↓                            │
│ Navigate to /tests           │
└──────────────────────────────┘
```

## Chip State Management

```
┌────────────────────────────────────────────────┐
│              ConfigChips State                  │
│                                                 │
│  behavior: [                                    │
│    { id: 'reliability', label: 'Reliability',  │
│      active: true },                            │
│    { id: 'compliance', label: 'Compliance',    │
│      active: false },                           │
│    ...                                          │
│  ]                                              │
│                                                 │
│  topics: [...]                                  │
│  category: [...]                                │
│  scenarios: [...]                               │
└────────────────┬───────────────────────────────┘
                 │
                 │  User clicks chip
                 │
                 v
┌────────────────────────────────────────────────┐
│      handleToggleChip(category, chipId)        │
│                                                 │
│  setConfigChips(prev => ({                     │
│    ...prev,                                     │
│    [category]: prev[category].map(chip =>      │
│      chip.id === chipId                        │
│        ? { ...chip, active: !chip.active }     │
│        : chip                                   │
│    )                                            │
│  }))                                            │
└────────────────┬───────────────────────────────┘
                 │
                 v
┌────────────────────────────────────────────────┐
│          Trigger sample regeneration           │
│                                                 │
│  - Debounced to avoid too many API calls       │
│  - Only if user is in interface screen         │
└────────────────────────────────────────────────┘
```

## Sample Rating Flow

```
User interacts with TestSampleCard:
     │
     │  User clicks thumbs up (rating = 5)
     │
     v
┌────────────────────────────────┐
│ handleRateTest(sampleId, 5)    │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ Update sample state            │
│ sample.rating = 5              │
│ sample.feedback = ''           │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ Trigger replace sample         │
│ (generate new one)             │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ API: generateTests(num=1)      │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ Replace sample in UI           │
│ (with animation)               │
└────────────────────────────────┘


     User clicks thumbs down (rating = 1)
     │
     v
┌────────────────────────────────┐
│ handleRateTest(sampleId, 1)    │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ Update sample state            │
│ sample.rating = 1              │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ Show feedback input            │
│ User types feedback            │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ Store feedback in sample       │
│ (Used in final generation)     │
└────────────────────────────────┘
```

## Document Processing Flow

```
User uploads file:
     │
     v
┌────────────────────────────────┐
│ 1. Create initial document     │
│    - status: 'uploading'       │
│    - show in UI immediately    │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 2. Upload to server            │
│    - ServicesClient.upload()   │
│    - Get file path             │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 3. Update status               │
│    - status: 'extracting'      │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 4. Extract content             │
│    - ServicesClient.extract()  │
│    - Get text content          │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 5. Update status               │
│    - status: 'generating'      │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 6. Generate metadata           │
│    - ServicesClient.metadata() │
│    - Get name & description    │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 7. Final status                │
│    - status: 'completed'       │
│    - Show in file list         │
│    - Ready for generation      │
└────────────────────────────────┘

If any step fails:
     │
     v
┌────────────────────────────────┐
│ - status: 'error'              │
│ - Show error message           │
│ - Allow retry/remove           │
└────────────────────────────────┘
```

## Endpoint Response Flow (New)

```
User selects endpoint in Input Screen:
     │
     v
┌────────────────────────────────┐
│ 1. Store selectedEndpointId    │
│    - Pass to interface         │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 2. Load endpoint info          │
│    - Fetch endpoint details    │
│    - Fetch project name        │
│    - Display in banner         │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 3. When samples are generated  │
│    - Filter unprocessed        │
│    - Set loading state         │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 4. For each sample (sequential)│
│    EndpointsClient             │
│    .invokeEndpoint(id, {       │
│      input: sample.prompt      │
│    })                          │
└────────┬───────────────────────┘
         │
         v  Returns: { output: "...", session_id, context }
┌────────────────────────────────┐
│ 5. Extract response            │
│    - Check output field        │
│    - Fallback to text/response │
│    - Update sample state       │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 6. Display in TestSampleCard   │
│    - Show response text        │
│    - Enable rating buttons     │
│    - Track processed IDs       │
└────────────────────────────────┘

On "Load More Samples":
     │
     v
┌────────────────────────────────┐
│ 1. Generate 5 new samples      │
│    - Keep existing ones        │
│    - Preserve responses        │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 2. Merge samples intelligently │
│    - Keep old with responses   │
│    - Add new ones              │
└────────┬───────────────────────┘
         │
         v
┌────────────────────────────────┐
│ 3. Fetch responses for new 5   │
│    - Only unprocessed samples  │
│    - Progressive UI updates    │
└────────────────────────────────┘

If endpoint call fails:
     │
     v
┌────────────────────────────────┐
│ - responseError: 'message'     │
│ - Show error in card           │
│ - Mark as processed            │
│ - Continue with next sample    │
└────────────────────────────────┘
```

## Screen Layout (Interface Screen)

```
┌─────────────────────────────────────────────────────────────────────┐
│  App Bar (Optional - if needed for project selector)                │
└─────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────┬──────────────────────────────────────┐
│                              │                                      │
│   LEFT PANEL (33%)           │   RIGHT PANEL (67%)                  │
│   Configuration              │   Preview                            │
│                              │                                      │
│ ┌──────────────────────────┐ │ ┌──────────────────────────────────┐│
│ │ Header: "Configuration"  │ │ │ Header: "Review Test Cases"      ││
│ │ - Icon                   │ │ │ - Badge: "X samples"             ││
│ │ - Description            │ │ │                                  ││
│ └──────────────────────────┘ │ └──────────────────────────────────┘│
│                              │                                      │
│ ┌──────────────────────────┐ │ ┌──────────────────────────────────┐│
│ │ Scrollable Area          │ │ │ 🔗 Endpoint Info Banner          ││
│ │                          │ │ │ Preview Endpoint: Project › Name ││
│ │ 🎯 Behavior Testing      │ │ │ [Production]                     ││
│ │ [Chip] [Chip] [Chip]     │ │ └──────────────────────────────────┘│
│ │                          │ │                                      │
│ │ 🔢 Topics                │ │ ┌──────────────────────────────────┐│
│ │ [Chip] [Chip] [Chip]     │ │ │ Scrollable Area                  ││
│ │                          │ │ │                                  ││
│ │ 🎨 Category              │ │ │ ┌────────────────────────────┐  ││
│ │ [Chip] [Chip] [Chip]     │ │ │ │ TestSampleCard #1          │  ││
│ │                          │ │ │ │ - Prompt (left aligned)    │  ││
│ │ ▶️  Scenarios            │ │ │ │ - Response (right, live)   │  ││
│ │ [Chip] [Chip] [Chip]     │ │ │ │ - 👍 👎 (rating)          │  ││
│ │                          │ │ │ └────────────────────────────┘  ││
│ └──────────────────────────┘ │ │                                  ││
│                              │ │ ┌────────────────────────────┐  ││
│ ┌──────────────────────────┐ │ │ │ TestSampleCard #2          │  ││
│ │ Uploaded Files           │ │ │ │ - Prompt                   │  ││
│ │ 📄 doc1.pdf [x]          │ │ │ │ - ⏳ Loading response...   │  ││
│ │ 📄 doc2.txt [x]          │ │ │ └────────────────────────────┘  ││
│ └──────────────────────────┘ │ │                                  ││
│                              │ │ ┌────────────────────────────┐  ││
│ ┌──────────────────────────┐ │ │ │ TestSampleCard #3          │  ││
│ │ Chat Input               │ │ │ │ ...                        │  ││
│ │ [+] Type message... [→]  │ │ │ └────────────────────────────┘  ││
│ └──────────────────────────┘ │ │                                  ││
│                              │ └──────────────────────────────────┘│
│                              │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  Bottom Action Bar                                                   │
│  [← Back]                                    [Generate Tests →]     │
└─────────────────────────────────────────────────────────────────────┘
```

## TestSample Data Structure (Updated)

```typescript
interface TestSample {
  id: string;
  prompt: string;
  response?: string;              // Generated or from endpoint
  behavior: string;
  topic: string;
  rating: number | null;          // 1-5 or null
  feedback: string;
  isLoadingResponse?: boolean;    // NEW: Loading state
  responseError?: string;         // NEW: Error state
}
```

## Key Features

### Endpoint Preview System
- **Optional Selection**: Users can select an endpoint in the input screen
- **Live Responses**: Test samples automatically show responses from the selected endpoint
- **Progressive Loading**: Responses load one-by-one, updating UI in real-time
- **Error Handling**: Individual errors per sample, doesn't block others
- **Intelligent Caching**: Only fetches responses for new samples when loading more
- **State Preservation**: When loading more samples, existing responses are kept

### Response Parsing
The system handles multiple endpoint response formats:
1. `output` field (primary)
2. `text` field
3. `response` field
4. `content` field
5. JSON stringified fallback

### Smart Sample Management
- **Merge Strategy**: Preserves existing samples with responses
- **Incremental Loading**: "Load More" adds 5 new samples without affecting existing ones
- **Endpoint Switching**: Changing endpoints re-fetches all responses with new endpoint

## Summary

This visualization shows:
1. **User Journey**: From landing to generation with endpoint preview
2. **Component Structure**: How components nest, including EndpointSelector
3. **Data Flow**: How state moves through the app with endpoint integration
4. **API Sequence**: Order of backend calls including endpoint invocation
5. **State Changes**: How UI state evolves with loading and error states
6. **Chip Management**: Interactive element behavior
7. **Rating System**: User feedback collection
8. **Document Pipeline**: File processing steps
9. **Endpoint Preview**: Live response fetching and display
10. **Screen Layout**: Physical arrangement of elements with endpoint info

All of these diagrams work together to provide a complete picture of how the test generation interface functions, including the new endpoint preview capability!
