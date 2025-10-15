'use client';

import React, { useState } from 'react';
import { Box, Typography, Alert, Paper } from '@mui/material';
import { Source } from '@/utils/api-client/interfaces/source';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { PageContainer } from '@toolpad/core/PageContainer';
import { useNotifications } from '@/components/common/NotificationContext';
import SourcesGrid from './SourcesGrid';
import styles from '@/styles/KnowledgeClientWrapper.module.css';

/** Type for alert/snackbar severity */
type AlertSeverity = 'success' | 'error' | 'info' | 'warning';

/** Props for the EmptyStateMessage component */
interface EmptyStateMessageProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

/**
 * Reusable empty state component with customizable title, description and icon
 */
function EmptyStateMessage({
  title,
  description,
  icon,
}: EmptyStateMessageProps) {
  return (
    <Paper elevation={2} className={styles.emptyState}>
      {icon || (
        <Box className={styles.iconContainer}>
          <MenuBookIcon className={styles.primaryIcon} />
        </Box>
      )}

      <Typography variant="h5" className={styles.title}>
        {title}
      </Typography>

      <Typography variant="body1" className={styles.description}>
        {description}
      </Typography>
    </Paper>
  );
}

/** Props for the KnowledgeClientWrapper component */
interface KnowledgeClientWrapperProps {
  initialSources: Source[];
  sessionToken: string;
}

/**
 * Client component for the Knowledge page
 * Handles displaying knowledge sources and managing interactive features
 */
export default function KnowledgeClientWrapper({
  initialSources = [],
  sessionToken,
}: KnowledgeClientWrapperProps) {
  const [sources, setSources] = useState<Source[]>(initialSources || []);
  const [refreshKey, setRefreshKey] = useState(0);
  const notifications = useNotifications();

  const handleRefresh = React.useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Show error state if no session token
  if (!sessionToken) {
    return (
      <PageContainer
        title="Knowledge"
        breadcrumbs={[{ title: 'Knowledge', path: '/knowledge' }]}
      >
        <Alert severity="error" sx={{ mb: 3 }}>
          Session expired. Please refresh the page or log in again.
        </Alert>
        <EmptyStateMessage
          title="Authentication Required"
          description="Please log in to view and manage your knowledge sources."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Knowledge"
      breadcrumbs={[{ title: 'Knowledge', path: '/knowledge' }]}
    >
      {/* Header */}
      <Box className={styles.header}>
        <Typography variant="h6" className={styles.headerTitle}>
          Manage your knowledge sources and documents
        </Typography>
      </Box>

      {/* Sources grid */}
      <Paper sx={{ width: '100%', mb: 2, mt: 4 }}>
        <Box sx={{ p: 2 }}>
          <SourcesGrid
            sessionToken={sessionToken}
            onRefresh={handleRefresh}
            key={`sources-grid-${refreshKey}`}
          />
        </Box>
      </Paper>
    </PageContainer>
  );
}
