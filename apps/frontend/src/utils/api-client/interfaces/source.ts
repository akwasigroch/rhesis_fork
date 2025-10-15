import { UUID } from 'crypto';
import { User } from './user';
import { TypeLookup } from './type-lookup';
import { Status } from './status';
import { PaginationParams } from './pagination';

export interface Source {
  id: UUID;
  title: string;
  description?: string;
  content?: string;
  source_type_id?: UUID;
  url?: string;
  citation?: string;
  language_code?: string;
  source_metadata?: Record<string, any>;
  tags: string[];
  counts?: {
    comments: number;
    tasks: number;
  };

  // References
  source_type?: TypeLookup;
  status?: Status;
  owner?: User;
  assignee?: User;
}

export interface SourceCreate {
  title: string;
  description?: string;
  content?: string;
  source_type_id?: UUID;
  url?: string;
  citation?: string;
  language_code?: string;
  source_metadata?: Record<string, any>;
  tags?: string[];
}

export interface SourceUpdate {
  title?: string;
  description?: string;
  content?: string;
  source_type_id?: UUID;
  url?: string;
  citation?: string;
  language_code?: string;
  source_metadata?: Record<string, any>;
  tags?: string[];
}

export interface SourcesQueryParams extends PaginationParams {
  $filter?: string;
  source_type_id?: UUID;
}
