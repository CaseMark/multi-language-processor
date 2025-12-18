'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Loader2, 
  RefreshCw,
  AlertCircle,
  Clock,
  Languages,
  ChevronRight,
  FolderOpen
} from 'lucide-react';
import { LanguageCode, SUPPORTED_LANGUAGES } from '@/lib/types';

interface VaultDocument {
  id: string;
  filename: string;
  contentType?: string;
  ingestionStatus?: string;
  createdAt?: string;
  pageCount?: number;
}

interface VaultDocumentBrowserProps {
  vaultId: string;
  onDocumentSelect: (document: {
    id: string;
    filename: string;
    originalLanguage: LanguageCode;
    originalText: string;
    translatedText: string;
    pageCount: number;
  }) => void;
}

export default function VaultDocumentBrowser({ vaultId, onDocumentSelect }: VaultDocumentBrowserProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/vaults/${vaultId}/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (vaultId) {
      fetchDocuments();
    }
  }, [vaultId]);

  const handleDocumentClick = async (doc: VaultDocument) => {
    setLoadingDocId(doc.id);
    setError(null);
    
    try {
      const response = await fetch(`/api/vaults/${vaultId}/documents/${doc.id}`);
      if (!response.ok) {
        throw new Error('Failed to load document');
      }
      const data = await response.json();
      
      onDocumentSelect({
        id: data.id,
        filename: data.filename,
        originalLanguage: (data.detectedLanguage || 'en') as LanguageCode,
        originalText: data.originalText,
        translatedText: data.translatedText,
        pageCount: data.pageCount || 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoadingDocId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFileIcon = (contentType?: string) => {
    if (contentType?.includes('pdf')) return '📄';
    if (contentType?.includes('image')) return '🖼️';
    if (contentType?.includes('text')) return '📝';
    return '📁';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-gray-600">Loading documents from vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-gray-500" />
          <h3 className="font-medium text-gray-800">Vault Documents</h3>
          <span className="text-sm text-gray-500">({documents.length})</span>
        </div>
        <button
          onClick={fetchDocuments}
          disabled={isLoading}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Refresh documents"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No documents in this vault</p>
          <p className="text-sm text-gray-500 mt-1">
            Upload documents to this vault first, or select a different vault
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-auto">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleDocumentClick(doc)}
              disabled={loadingDocId === doc.id}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                ${loadingDocId === doc.id ? 'bg-blue-50' : ''}
                disabled:cursor-wait
              `}
            >
              <div className="flex items-center gap-3">
                {/* File Icon */}
                <div className="text-2xl flex-shrink-0">
                  {getFileIcon(doc.contentType)}
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {doc.createdAt && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(doc.createdAt)}
                      </span>
                    )}
                    {doc.pageCount && (
                      <span className="text-xs text-gray-500">
                        {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Loading/Arrow */}
                <div className="flex-shrink-0">
                  {loadingDocId === doc.id ? (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Translating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-gray-400">
                      <Languages className="w-4 h-4" />
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Click a document to extract text and translate to English
        </p>
      </div>
    </div>
  );
}
