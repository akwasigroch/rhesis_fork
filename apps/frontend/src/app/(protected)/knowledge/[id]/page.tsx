export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { ApiClientFactory } from '@/utils/api-client/client-factory';
import SourcePreviewClientWrapper from './components/SourcePreviewClientWrapper';
import { Box, Typography, Alert, Paper } from '@mui/material';
import styles from '@/styles/KnowledgePage.module.css';
import { notFound } from 'next/navigation';

interface SourcePreviewPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Server component for the Source Preview page
 * Fetches source data and renders the client wrapper component
 */
export default async function SourcePreviewPage({
  params,
}: SourcePreviewPageProps) {
  try {
    const session = await auth();

    if (!session?.session_token) {
      return (
        <Paper className={styles.errorContainer}>
          <Alert severity="error">
            Authentication required. Please sign in to view source content.
          </Alert>
        </Paper>
      );
    }

    const apiFactory = new ApiClientFactory(session.session_token);
    const sourcesClient = apiFactory.getSourcesClient();

    // Await params before using its properties (Next.js 15 requirement)
    const resolvedParams = await params;

    // Fetch source details
    const source = await sourcesClient.getSource(resolvedParams.id as any);

    return (
      <SourcePreviewClientWrapper
        source={source}
        sessionToken={session.session_token}
      />
    );
  } catch (error) {
    console.error('Error loading source:', error);

    // If source not found, return 404
    if (error instanceof Error && error.message.includes('404')) {
      notFound();
    }

    // Show error state for other errors
    return (
      <Paper className={styles.errorContainer}>
        <Alert severity="error">
          {error instanceof Error
            ? error.message
            : 'Failed to load source content. Please try again.'}
        </Alert>
      </Paper>
    );
  }
}
