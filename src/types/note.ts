export interface Note {
  id: string;
  title: string;
  content: string; // HTML string stored by TipTap
  plainTextPreview: string; // snippet for list preview
  drawingStrokes?: string; // JSON string of DrawingStroke[] for seamless in-note stylus annotations
  folderId: string;
  isPinned: boolean;
  isTrash?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  isSystem?: boolean;
}

export type ViewMode = 'list' | 'gallery';

export type FilterFolderId = string; // folder ID or special like 'all' | 'trash' | 'pinned'

