'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress } from '@mui/material';
import { ApiClientFactory } from '@/utils/api-client/client-factory';
import { useNotifications } from '@/components/common/NotificationContext';
import {
  FlowStep,
  GenerationMode,
  ConfigChips,
  TestSample,
  ChatMessage,
  TestSetSize,
  TestTemplate,
  ChipConfig,
} from './shared/types';
import { ProcessedDocument } from '@/utils/api-client/interfaces/documents';
import { Project } from '@/utils/api-client/interfaces/project';
import {
  TestSetGenerationRequest,
  TestSetGenerationConfig,
  GenerationSample,
} from '@/utils/api-client/interfaces/test-set';
import TestInputScreen from './TestInputScreen';
import TestGenerationInterface from './TestGenerationInterface';
import TestConfigurationConfirmation from './TestConfigurationConfirmation';
import { TEMPLATES } from '@/config/test-templates';

interface TestGenerationFlowProps {
  sessionToken: string;
}

// Initial empty chip configurations
const createEmptyChips = (): ConfigChips => {
  return {
    behavior: [],
    topics: [],
    category: [],
    scenarios: [],
  };
};

/**
 * TestGenerationFlow Component
 * Main orchestrator for the test generation flow
 */
export default function TestGenerationFlow({
  sessionToken,
}: TestGenerationFlowProps) {
  const router = useRouter();
  const { show } = useNotifications();

  // Check if template exists before initializing state
  const hasTemplate =
    typeof window !== 'undefined' &&
    sessionStorage.getItem('selectedTemplateId') !== null;

  // Navigation State - start with null to prevent premature rendering
  const [currentScreen, setCurrentScreen] = useState<FlowStep | null>(
    hasTemplate ? null : 'input'
  );
  const [mode, setMode] = useState<GenerationMode | null>(
    hasTemplate ? 'template' : 'ai'
  );

  // Data State
  const [description, setDescription] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    null
  );
  const [configChips, setConfigChips] =
    useState<ConfigChips>(createEmptyChips());
  const [testSamples, setTestSamples] = useState<TestSample[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [testSetSize, setTestSetSize] = useState<TestSetSize>('medium');
  const [testSetName, setTestSetName] = useState('');

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [regeneratingSampleId, setRegeneratingSampleId] = useState<
    string | null
  >(null);

  // Check for template on mount and directly create config from template values
  useEffect(() => {
    const initializeFromTemplate = async () => {
      try {
        // Check if coming from template selection
        const templateId = sessionStorage.getItem('selectedTemplateId');
        if (templateId) {
          try {
            // Look up template by ID
            const template = TEMPLATES.find(t => t.id === templateId);
            if (!template) {
              throw new Error(`Template with ID ${templateId} not found`);
            }
            sessionStorage.removeItem('selectedTemplateId');

            setMode('template');
            setDescription(template.description);
            setIsGenerating(true);

            // Create chips directly from template values (no API call needed)
            const createChipsFromArray = (
              items: string[],
              colorVariant: string
            ): ChipConfig[] => {
              return items.map(item => ({
                id: item.toLowerCase().replace(/\s+/g, '-'),
                label: item,
                description: '',
                active: true, // All template chips are active
                colorVariant,
              }));
            };

            const newConfigChips: ConfigChips = {
              behavior: createChipsFromArray(template.behaviors, 'blue'),
              topics: createChipsFromArray(template.topics, 'purple'),
              category: createChipsFromArray(template.category, 'orange'),
              scenarios: createChipsFromArray(template.scenarios, 'green'),
            };

            setConfigChips(newConfigChips);

            // Generate initial test samples directly
            const apiFactory = new ApiClientFactory(sessionToken);
            const servicesClient = apiFactory.getServicesClient();

            const prompt = {
              project_context: project?.name || 'General',
              test_behaviors: template.behaviors,
              test_purposes: template.topics,
              key_topics: template.topics,
              specific_requirements: template.description,
              test_type: 'Single interaction tests',
              output_format: 'Generate only user inputs',
            };

            const response = await servicesClient.generateTests({
              prompt,
              num_tests: 5,
              documents: [],
            });

            if (response.tests?.length) {
              const newSamples: TestSample[] = response.tests.map(
                (test, index) => ({
                  id: `sample-${Date.now()}-${index}`,
                  prompt: test.prompt.content,
                  response: test.prompt.expected_response,
                  behavior: test.behavior,
                  topic: test.topic,
                  rating: null,
                  feedback: '',
                })
              );

              setTestSamples(newSamples);
            }

            // Navigate to interface screen after samples are generated
            setCurrentScreen('interface');
            setIsGenerating(false);
            show('Template loaded successfully', { severity: 'success' });
          } catch (e) {
            console.error('Failed to parse or generate from template:', e);
            setIsGenerating(false);
            show('Failed to load template', {
              severity: 'error',
            });
          }
        }
      } catch (error) {
        console.error('Failed to initialize from template:', error);
        show('Failed to load template', { severity: 'error' });
      }
    };

    initializeFromTemplate();
  }, [sessionToken, show, project]);

  // Input Screen Handler
  const handleContinueFromInput = useCallback(
    async (desc: string, sourceIds: string[]) => {
      setDescription(desc);
      setSelectedSourceIds(sourceIds);

      // Generate test configuration and samples before navigating
      setIsGenerating(true);
      try {
        const apiFactory = new ApiClientFactory(sessionToken);
        const servicesClient = apiFactory.getServicesClient();
        const sourcesClient = apiFactory.getSourcesClient();

        // Fetch source content for selected sources
        const fetchedDocuments: ProcessedDocument[] = [];
        for (const sourceId of sourceIds) {
          try {
            const source = await sourcesClient.getSource(sourceId as any);
            fetchedDocuments.push({
              id: source.id,
              name: source.title,
              description: source.description || '',
              path: '',
              content: source.content || '',
              originalName: source.title,
              status: 'completed',
            });
          } catch (error) {
            console.error(`Failed to fetch source ${sourceId}:`, error);
            show(`Failed to load source: ${sourceId}`, { severity: 'warning' });
          }
        }
        setDocuments(fetchedDocuments);

        // Step 1: Generate test configuration based on description
        const configResponse = await servicesClient.generateTestConfig({
          prompt: desc,
          sample_size: 10,
        });

        console.log('Config response:', configResponse);

        // Step 2: Create chips from config response (5 active, 5 inactive)
        const createChipsFromArray = (
          items: Array<{ name: string; description: string }>,
          colorVariant: string
        ): ChipConfig[] => {
          return items.map((item, index) => {
            return {
              id: item.name.toLowerCase().replace(/\s+/g, '-'),
              label: item.name,
              description: item.description,
              active: index < 5, // First 5 are active
              colorVariant,
            };
          });
        };

        const newConfigChips: ConfigChips = {
          behavior: createChipsFromArray(configResponse.behaviors, 'blue'),
          topics: createChipsFromArray(configResponse.topics, 'purple'),
          category: createChipsFromArray(configResponse.categories, 'orange'),
          scenarios: createChipsFromArray(configResponse.scenarios, 'green'),
        };

        setConfigChips(newConfigChips);

        // Step 3: Generate initial test samples
        const activeBehaviors = newConfigChips.behavior
          .filter(c => c.active)
          .map(c => c.label);
        const activeTopics = newConfigChips.topics
          .filter(c => c.active)
          .map(c => c.label);

        const prompt = {
          project_context: project?.name || 'General',
          test_behaviors: activeBehaviors,
          test_purposes: activeTopics,
          key_topics: activeTopics,
          specific_requirements: desc,
          test_type: 'Single interaction tests',
          output_format: 'Generate only user inputs',
        };

        const documentPayload = fetchedDocuments
          .filter(doc => doc.description && doc.description.trim())
          .map(doc => ({
            name: doc.name,
            description: doc.description,
            content: doc.content,
          }));

        const response = await servicesClient.generateTests({
          prompt,
          num_tests: 5,
          documents: documentPayload,
        });

        if (response.tests?.length) {
          const newSamples: TestSample[] = response.tests.map(
            (test, index) => ({
              id: `sample-${Date.now()}-${index}`,
              prompt: test.prompt.content,
              response: test.prompt.expected_response,
              behavior: test.behavior,
              topic: test.topic,
              rating: null,
              feedback: '',
            })
          );

          setTestSamples(newSamples);

          // Only navigate after both API calls complete successfully
          setCurrentScreen('interface');
        }
      } catch (error) {
        console.error('Error generating configuration and samples:', error);
        show('Failed to generate configuration', { severity: 'error' });
      } finally {
        setIsGenerating(false);
      }
    },
    [sessionToken, project, show]
  );

  // Document processing
  const processDocument = useCallback(
    async (file: File) => {
      const documentId = Math.random().toString(36).substr(2, 9);

      const initialDoc: ProcessedDocument = {
        id: documentId,
        name: '',
        description: '',
        path: '',
        content: '',
        originalName: file.name,
        status: 'uploading',
      };

      setDocuments(prev => [...prev, initialDoc]);

      try {
        const apiFactory = new ApiClientFactory(sessionToken);
        const servicesClient = apiFactory.getServicesClient();

        // Upload document
        const uploadResponse = await servicesClient.uploadDocument(file);

        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId
              ? {
                  ...doc,
                  path: uploadResponse.path,
                  status: 'extracting' as const,
                }
              : doc
          )
        );

        // Extract content
        const extractResponse = await servicesClient.extractDocument(
          uploadResponse.path
        );

        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId
              ? {
                  ...doc,
                  content: extractResponse.content,
                  status: 'generating' as const,
                }
              : doc
          )
        );

        // Generate metadata
        const metadata = await servicesClient.generateDocumentMetadata(
          extractResponse.content
        );

        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId
              ? {
                  ...doc,
                  name: metadata.name,
                  description: metadata.description,
                  status: 'completed' as const,
                }
              : doc
          )
        );

        show(`Document "${file.name}" processed successfully`, {
          severity: 'success',
        });
      } catch (error) {
        console.error('Error processing document:', error);
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId ? { ...doc, status: 'error' as const } : doc
          )
        );
        show(`Failed to process document "${file.name}"`, {
          severity: 'error',
        });
      }
    },
    [sessionToken, show]
  );

  // Generate test samples
  const generateSamples = useCallback(async () => {
    setIsGenerating(true);
    try {
      const apiFactory = new ApiClientFactory(sessionToken);
      const servicesClient = apiFactory.getServicesClient();

      // Build prompt from configuration
      const activeBehaviors = configChips.behavior
        .filter(c => c.active)
        .map(c => c.label);
      const activeTopics = configChips.topics
        .filter(c => c.active)
        .map(c => c.label);

      const prompt = {
        project_context: project?.name || 'General',
        test_behaviors: activeBehaviors,
        test_purposes: activeTopics,
        key_topics: activeTopics,
        specific_requirements: description,
        test_type: 'Single interaction tests',
        output_format: 'Generate only user inputs',
      };

      const documentPayload = documents
        .filter(
          doc =>
            doc.status === 'completed' &&
            doc.description &&
            doc.description.trim()
        )
        .map(doc => ({
          name: doc.name,
          description: doc.description,
          content: doc.content,
        }));

      const response = await servicesClient.generateTests({
        prompt,
        num_tests: 5,
        documents: documentPayload,
      });

      if (response.tests?.length) {
        const newSamples: TestSample[] = response.tests.map((test, index) => ({
          id: `sample-${Date.now()}-${index}`,
          prompt: test.prompt.content,
          response: test.prompt.expected_response,
          behavior: test.behavior,
          topic: test.topic,
          rating: null,
          feedback: '',
        }));

        setTestSamples(newSamples);
        show('Samples generated successfully', { severity: 'success' });
      }
    } catch (error) {
      console.error('Error generating samples:', error);
      show('Failed to generate samples', { severity: 'error' });
    } finally {
      setIsGenerating(false);
    }
  }, [sessionToken, description, configChips, documents, project, show]);

  // Regenerate sample with feedback
  const handleRegenerateSample = useCallback(
    async (sampleId: string, feedback: string) => {
      // Find the sample
      const sample = testSamples.find(s => s.id === sampleId);
      if (!sample) return;

      setRegeneratingSampleId(sampleId);

      try {
        const apiFactory = new ApiClientFactory(sessionToken);
        const servicesClient = apiFactory.getServicesClient();

        // Build prompt from configuration with feedback
        const activeBehaviors = configChips.behavior
          .filter(c => c.active)
          .map(c => c.label);
        const activeTopics = configChips.topics
          .filter(c => c.active)
          .map(c => c.label);

        const prompt = {
          project_context: project?.name || 'General',
          test_behaviors: activeBehaviors,
          test_purposes: activeTopics,
          key_topics: activeTopics,
          specific_requirements: `${description}\n\nPrevious test: "${sample.prompt}"\n\nUser feedback: ${feedback}\n\nPlease generate a new test that addresses this feedback.`,
          test_type: 'Single interaction tests',
          output_format: 'Generate only user inputs',
        };

        const documentPayload = documents
          .filter(
            doc =>
              doc.status === 'completed' &&
              doc.description &&
              doc.description.trim()
          )
          .map(doc => ({
            name: doc.name,
            description: doc.description,
            content: doc.content,
          }));

        const response = await servicesClient.generateTests({
          prompt,
          num_tests: 1,
          documents: documentPayload,
        });

        if (response.tests?.length) {
          const newSample: TestSample = {
            id: `sample-${Date.now()}-regenerated`,
            prompt: response.tests[0].prompt.content,
            response: response.tests[0].prompt.expected_response,
            behavior: response.tests[0].behavior,
            topic: response.tests[0].topic,
            rating: null,
            feedback: '',
          };

          // Replace the old sample with the new one
          setTestSamples(prev =>
            prev.map(s => (s.id === sampleId ? newSample : s))
          );

          show('Sample regenerated successfully', { severity: 'success' });
        }
      } catch (error) {
        console.error('Error regenerating sample:', error);
        show('Failed to regenerate sample', { severity: 'error' });
      } finally {
        setRegeneratingSampleId(null);
      }
    },
    [
      sessionToken,
      description,
      configChips,
      documents,
      project,
      testSamples,
      show,
    ]
  );

  // Interface Handlers
  const handleChipToggle = useCallback(
    (category: keyof ConfigChips, chipId: string) => {
      setConfigChips(prev => ({
        ...prev,
        [category]: prev[category].map(chip =>
          chip.id === chipId ? { ...chip, active: !chip.active } : chip
        ),
      }));
    },
    []
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'user',
        content: message,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, newMessage]);

      setIsGenerating(true);
      try {
        const apiFactory = new ApiClientFactory(sessionToken);
        const servicesClient = apiFactory.getServicesClient();

        // Build complete iteration context

        // 1. Collect all chip states (both selected and deselected)
        const chipStates: Array<{
          label: string;
          description: string;
          active: boolean;
          category: 'behavior' | 'topic' | 'category' | 'scenario';
        }> = [
          ...configChips.behavior.map(chip => ({
            label: chip.label,
            description: chip.description,
            active: chip.active,
            category: 'behavior' as const,
          })),
          ...configChips.topics.map(chip => ({
            label: chip.label,
            description: chip.description,
            active: chip.active,
            category: 'topic' as const,
          })),
          ...configChips.category.map(chip => ({
            label: chip.label,
            description: chip.description,
            active: chip.active,
            category: 'category' as const,
          })),
          ...configChips.scenarios.map(chip => ({
            label: chip.label,
            description: chip.description,
            active: chip.active,
            category: 'scenario' as const,
          })),
        ];

        // 2. Collect all rated samples with feedback
        const ratedSamples = testSamples
          .filter(sample => sample.rating !== null)
          .map(sample => ({
            prompt: sample.prompt,
            response: sample.response,
            rating: sample.rating as number,
            feedback:
              sample.feedback && sample.feedback.trim()
                ? sample.feedback
                : undefined,
          }));

        // 3. Collect all previous user messages (not assistant responses)
        const previousMessages = chatMessages
          .filter(msg => msg.type === 'user')
          .map(msg => ({
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
          }));

        console.log('Sending to generateTestConfig:', {
          prompt: description,
          sample_size: 10,
          chip_states: chipStates.length,
          rated_samples: ratedSamples,
          previous_messages: [
            ...previousMessages,
            {
              content: message,
              timestamp: newMessage.timestamp.toISOString(),
            },
          ],
        });

        // Step 1: Regenerate test configuration with full iteration context
        const configResponse = await servicesClient.generateTestConfig({
          prompt: description, // Keep original prompt separate
          sample_size: 10,
          chip_states: chipStates,
          rated_samples: ratedSamples,
          previous_messages: [
            ...previousMessages,
            {
              content: message,
              timestamp: newMessage.timestamp.toISOString(),
            },
          ],
        });

        // Step 2: Create chips from config response (5 active, 5 inactive)
        const createChipsFromArray = (
          items: Array<{ name: string; description: string }>,
          colorVariant: string
        ): ChipConfig[] => {
          return items.map((item, index) => {
            return {
              id: item.name.toLowerCase().replace(/\s+/g, '-'),
              label: item.name,
              description: item.description,
              active: index < 5, // First 5 are active
              colorVariant,
            };
          });
        };

        const newConfigChips: ConfigChips = {
          behavior: createChipsFromArray(configResponse.behaviors, 'blue'),
          topics: createChipsFromArray(configResponse.topics, 'purple'),
          category: createChipsFromArray(configResponse.categories, 'orange'),
          scenarios: createChipsFromArray(configResponse.scenarios, 'green'),
        };

        setConfigChips(newConfigChips);

        // Step 3: Generate new test samples with updated configuration
        const activeBehaviors = newConfigChips.behavior
          .filter(c => c.active)
          .map(c => c.label);
        const activeTopics = newConfigChips.topics
          .filter(c => c.active)
          .map(c => c.label);

        // Build prompt with basic context (detailed context sent separately)
        const prompt = {
          project_context: project?.name || 'General',
          test_behaviors: activeBehaviors,
          test_purposes: activeTopics,
          key_topics: activeTopics,
          specific_requirements: description,
          test_type: 'Single interaction tests',
          output_format: 'Generate only user inputs',
        };

        const documentPayload = documents
          .filter(
            doc =>
              doc.status === 'completed' &&
              doc.description &&
              doc.description.trim()
          )
          .map(doc => ({
            name: doc.name,
            description: doc.description,
            content: doc.content,
          }));

        const response = await servicesClient.generateTests({
          prompt,
          num_tests: 5,
          documents: documentPayload,
          chip_states: chipStates,
          rated_samples: ratedSamples,
          previous_messages: [
            ...previousMessages,
            {
              content: message,
              timestamp: newMessage.timestamp.toISOString(),
            },
          ],
        });

        if (response.tests?.length) {
          const newSamples: TestSample[] = response.tests.map(
            (test, index) => ({
              id: `sample-${Date.now()}-${index}`,
              prompt: test.prompt.content,
              response: test.prompt.expected_response,
              behavior: test.behavior,
              topic: test.topic,
              rating: null,
              feedback: '',
            })
          );

          setTestSamples(newSamples);

          // Add assistant response to chat
          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            type: 'assistant',
            content:
              'Configuration and samples updated based on your refinement.',
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, assistantMessage]);

          show('Test generation refined successfully', { severity: 'success' });
        }
      } catch (error) {
        console.error('Error refining test generation:', error);
        show('Failed to refine test generation', { severity: 'error' });
      } finally {
        setIsGenerating(false);
      }
    },
    [
      sessionToken,
      description,
      documents,
      project,
      show,
      configChips,
      testSamples,
      chatMessages,
    ]
  );

  const handleRateSample = useCallback((sampleId: string, rating: number) => {
    setTestSamples(prev =>
      prev.map(sample =>
        sample.id === sampleId ? { ...sample, rating } : sample
      )
    );
  }, []);

  const handleSampleFeedbackChange = useCallback(
    (sampleId: string, feedback: string) => {
      setTestSamples(prev =>
        prev.map(sample =>
          sample.id === sampleId ? { ...sample, feedback } : sample
        )
      );
    },
    []
  );

  const handleLoadMoreSamples = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const apiFactory = new ApiClientFactory(sessionToken);
      const servicesClient = apiFactory.getServicesClient();

      const activeBehaviors = configChips.behavior
        .filter(c => c.active)
        .map(c => c.label);
      const activeTopics = configChips.topics
        .filter(c => c.active)
        .map(c => c.label);

      const prompt = {
        project_context: project?.name || 'General',
        test_behaviors: activeBehaviors,
        test_purposes: activeTopics,
        key_topics: activeTopics,
        specific_requirements: description,
        test_type: 'Single interaction tests',
        output_format: 'Generate only user inputs',
      };

      const documentPayload = documents
        .filter(
          doc =>
            doc.status === 'completed' &&
            doc.description &&
            doc.description.trim()
        )
        .map(doc => ({
          name: doc.name,
          description: doc.description,
          content: doc.content,
        }));

      // Collect iteration context for "Load More"
      const chipStates = [
        ...configChips.behavior.map(chip => ({
          label: chip.label,
          description: chip.description,
          active: chip.active,
          category: 'behavior' as const,
        })),
        ...configChips.topics.map(chip => ({
          label: chip.label,
          description: chip.description,
          active: chip.active,
          category: 'topic' as const,
        })),
        ...configChips.category.map(chip => ({
          label: chip.label,
          description: chip.description,
          active: chip.active,
          category: 'category' as const,
        })),
        ...configChips.scenarios.map(chip => ({
          label: chip.label,
          description: chip.description,
          active: chip.active,
          category: 'scenario' as const,
        })),
      ];

      const ratedSamples = testSamples
        .filter(sample => sample.rating !== null)
        .map(sample => ({
          prompt: sample.prompt,
          response: sample.response,
          rating: sample.rating as number,
          feedback: sample.feedback || undefined,
        }));

      const previousMessages = chatMessages
        .filter(msg => msg.type === 'user')
        .map(msg => ({
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        }));

      const response = await servicesClient.generateTests({
        prompt,
        num_tests: 5,
        documents: documentPayload,
        chip_states: chipStates,
        rated_samples: ratedSamples,
        previous_messages: previousMessages,
      });

      if (response.tests?.length) {
        const newSamples: TestSample[] = response.tests.map((test, index) => ({
          id: `sample-${Date.now()}-${index}`,
          prompt: test.prompt.content,
          response: test.prompt.expected_response,
          behavior: test.behavior,
          topic: test.topic,
          rating: null,
          feedback: '',
        }));

        setTestSamples(prev => [...prev, ...newSamples]);
      }
    } catch (error) {
      console.error('Error loading more samples:', error);
      show('Failed to load more samples', { severity: 'error' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessionToken, description, configChips, documents, project, show]);

  // Final generation
  const handleGenerate = useCallback(async () => {
    setIsFinishing(true);
    try {
      const apiFactory = new ApiClientFactory(sessionToken);
      const testSetsClient = apiFactory.getTestSetsClient();

      const activeBehaviors = configChips.behavior
        .filter(c => c.active)
        .map(c => c.label);
      const activeTopics = configChips.topics
        .filter(c => c.active)
        .map(c => c.label);

      // Map test set size to actual number of tests
      // Small: 25-50 tests, Medium: 75-150 tests, Large: 200+ tests
      const numTests =
        testSetSize === 'small' ? 50 : testSetSize === 'large' ? 200 : 100;

      const generationConfig: TestSetGenerationConfig = {
        project_name: project?.name,
        behaviors: activeBehaviors,
        purposes: activeTopics,
        test_type: 'single_turn',
        response_generation: 'prompt_only',
        test_coverage:
          testSetSize === 'small'
            ? 'focused'
            : testSetSize === 'large'
              ? 'comprehensive'
              : 'standard',
        tags: activeTopics,
        description,
      };

      const generationSamples: GenerationSample[] = testSamples.map(sample => ({
        text: sample.prompt,
        behavior: sample.behavior,
        topic: sample.topic,
        rating: sample.rating,
        feedback: sample.feedback,
      }));

      const request: TestSetGenerationRequest = {
        config: generationConfig,
        samples: generationSamples,
        synthesizer_type: 'prompt',
        batch_size: 20,
        num_tests: numTests,
      };

      const response = await testSetsClient.generateTestSet(request);

      show(response.message, { severity: 'success' });
      console.log('Test generation task started:', {
        taskId: response.task_id,
        estimatedTests: response.estimated_tests,
      });

      setTimeout(() => router.push('/tests'), 2000);
    } catch (error) {
      console.error('Failed to start test generation:', error);
      show('Failed to start test generation. Please try again.', {
        severity: 'error',
      });
    } finally {
      setIsFinishing(false);
    }
  }, [
    sessionToken,
    configChips,
    description,
    testSamples,
    testSetSize,
    project,
    router,
    show,
  ]);

  // Document handlers
  const handleDocumentRemove = useCallback((documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  }, []);

  const handleDocumentAdd = useCallback((document: ProcessedDocument) => {
    setDocuments(prev => [...prev, document]);
  }, []);

  // Navigation handlers
  const handleBackToInput = useCallback(() => {
    setCurrentScreen('input');
  }, []);

  const handleBackToInterface = useCallback(() => {
    setCurrentScreen('interface');
  }, []);

  const handleNextToConfirmation = useCallback(() => {
    setCurrentScreen('confirmation');
  }, []);

  // Render current screen
  const renderCurrentScreen = () => {
    // Show loading state while initializing from template
    if (currentScreen === null) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            bgcolor: 'background.default',
          }}
        >
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1">Loading template...</Typography>
        </Box>
      );
    }

    switch (currentScreen) {
      case 'input':
        return (
          <TestInputScreen
            onContinue={handleContinueFromInput}
            initialDescription={description}
            selectedSourceIds={selectedSourceIds}
            onSourcesChange={setSelectedSourceIds}
            isLoading={isGenerating}
          />
        );

      case 'interface':
        return (
          <TestGenerationInterface
            configChips={configChips}
            testSamples={testSamples}
            chatMessages={chatMessages}
            documents={documents}
            description={description}
            selectedEndpointId={selectedEndpointId}
            onChipToggle={handleChipToggle}
            onSendMessage={handleSendMessage}
            onRateSample={handleRateSample}
            onSampleFeedbackChange={handleSampleFeedbackChange}
            onLoadMoreSamples={handleLoadMoreSamples}
            onRegenerate={handleRegenerateSample}
            onBack={handleBackToInput}
            onNext={handleNextToConfirmation}
            onEndpointChange={setSelectedEndpointId}
            onDocumentRemove={handleDocumentRemove}
            onDocumentAdd={handleDocumentAdd}
            isGenerating={isGenerating}
            isLoadingMore={isLoadingMore}
            regeneratingSampleId={regeneratingSampleId}
          />
        );

      case 'confirmation':
        return (
          <TestConfigurationConfirmation
            configChips={configChips}
            documents={documents}
            testSetSize={testSetSize}
            testSetName={testSetName}
            onBack={handleBackToInterface}
            onGenerate={handleGenerate}
            onTestSetSizeChange={setTestSetSize}
            onTestSetNameChange={setTestSetName}
            isGenerating={isFinishing}
          />
        );

      default:
        return null;
    }
  };

  return <>{renderCurrentScreen()}</>;
}
