'use client';

import React, { useState } from 'react';
import { 
  Globe, 
  FileText, 
  Search, 
  Languages, 
  Award,
  ChevronRight,
  Upload,
  Trash2
} from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import SplitPaneViewer from '@/components/SplitPaneViewer';
import BilingualSearch from '@/components/BilingualSearch';
import CertifiedExport from '@/components/CertifiedExport';
import { LanguageCode, SUPPORTED_LANGUAGES } from '@/lib/types';

interface ProcessedDocument {
  id: string;
  filename: string;
  originalLanguage: LanguageCode;
  originalText: string;
  translatedText: string;
  pageCount: number;
  uploadedAt: string;
}

type ViewMode = 'upload' | 'viewer' | 'search';

export default function Home() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedChunks, setHighlightedChunks] = useState<{ original: string[]; translated: string[] } | undefined>();
  const [showExportModal, setShowExportModal] = useState(false);

  // Handle document processed
  const handleDocumentProcessed = (doc: {
    id: string;
    filename: string;
    originalLanguage: LanguageCode;
    originalText: string;
    translatedText: string;
    pageCount: number;
  }) => {
    const newDoc: ProcessedDocument = {
      ...doc,
      uploadedAt: new Date().toISOString(),
    };
    setDocuments(prev => [...prev, newDoc]);
    setSelectedDocument(newDoc);
    setViewMode('viewer');
  };

  // Handle document selection
  const handleSelectDocument = (docId: string, chunks?: { original: string[]; translated: string[] }) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setSelectedDocument(doc);
      setHighlightedChunks(chunks);
      setViewMode('viewer');
    }
  };

  // Handle search results
  const handleSearchResults = (results: unknown[], query: string) => {
    setSearchQuery(query);
  };

  // Delete document
  const handleDeleteDocument = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (selectedDocument?.id === docId) {
      setSelectedDocument(null);
      setViewMode('upload');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Multi-Language Processor</h1>
                <p className="text-xs text-gray-500">OCR • Translate • Search</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('upload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'upload' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
              <button
                onClick={() => setViewMode('viewer')}
                disabled={!selectedDocument}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'viewer' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <Languages className="w-4 h-4" />
                Viewer
              </button>
              <button
                onClick={() => setViewMode('search')}
                disabled={documents.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'search' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {selectedDocument && (
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                >
                  <Award className="w-4 h-4" />
                  Export Certificate
                </button>
              )}
              <div className="text-sm text-gray-500">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Sidebar - Document List */}
          {documents.length > 0 && (
            <aside className="w-72 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-800">Documents</h2>
                </div>
                <div className="divide-y divide-gray-100 max-h-[calc(100vh-200px)] overflow-auto">
                  {documents.map((doc) => {
                    const langInfo = SUPPORTED_LANGUAGES[doc.originalLanguage];
                    const isSelected = selectedDocument?.id === doc.id;
                    
                    return (
                      <div
                        key={doc.id}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleSelectDocument(doc.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              isSelected ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${
                                isSelected ? 'text-blue-700' : 'text-gray-700'
                              }`}>
                                {doc.filename}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-xs">{langInfo.flag}</span>
                                <span className="text-xs text-gray-500">{langInfo.name}</span>
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                                <span className="text-xs">🇺🇸</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDocument(doc.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Upload View */}
            {viewMode === 'upload' && (
              <div className="space-y-8">
                {/* Hero Section */}
                {documents.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Globe className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Multi-Language Document Processor
                    </h2>
                    <p className="text-gray-600 max-w-lg mx-auto">
                      Upload documents in any language. We&apos;ll automatically detect the language, 
                      extract text with OCR, translate to English, and make everything searchable.
                    </p>
                  </div>
                )}

                {/* Upload Component */}
                <DocumentUpload
                  onDocumentProcessed={handleDocumentProcessed}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />

                {/* Features */}
                {documents.length === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <div className="bg-white p-6 rounded-xl border border-gray-200">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <Globe className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">50+ Languages</h3>
                      <p className="text-sm text-gray-600">
                        Support for Japanese, Chinese, Korean, Arabic, Russian, and many more languages.
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                        <Languages className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">Side-by-Side View</h3>
                      <p className="text-sm text-gray-600">
                        View original and translated text side by side with synchronized scrolling.
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200">
                      <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                        <Award className="w-6 h-6 text-amber-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">Certified Export</h3>
                      <p className="text-sm text-gray-600">
                        Export translations with certification statements for legal proceedings.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Viewer View */}
            {viewMode === 'viewer' && selectedDocument && (
              <div className="h-[calc(100vh-180px)]">
                <SplitPaneViewer
                  originalText={selectedDocument.originalText}
                  translatedText={selectedDocument.translatedText}
                  originalLanguage={selectedDocument.originalLanguage}
                  filename={selectedDocument.filename}
                  searchQuery={searchQuery}
                  highlightedChunks={highlightedChunks}
                />
              </div>
            )}

            {/* Viewer Empty State */}
            {viewMode === 'viewer' && !selectedDocument && (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] bg-white rounded-lg border border-gray-200">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">No document selected</p>
                <p className="text-sm text-gray-500 mt-1">Upload a document or select one from the sidebar</p>
                <button
                  onClick={() => setViewMode('upload')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upload Document
                </button>
              </div>
            )}

            {/* Search View */}
            {viewMode === 'search' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <BilingualSearch
                  documents={documents}
                  onSearchResults={handleSearchResults}
                  onSelectDocument={handleSelectDocument}
                />
              </div>
            )}

            {/* Search Empty State */}
            {viewMode === 'search' && documents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] bg-white rounded-lg border border-gray-200">
                <Search className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">No documents to search</p>
                <p className="text-sm text-gray-500 mt-1">Upload documents first to enable search</p>
                <button
                  onClick={() => setViewMode('upload')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upload Document
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Export Modal */}
      {showExportModal && selectedDocument && (
        <CertifiedExport
          document={selectedDocument}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
