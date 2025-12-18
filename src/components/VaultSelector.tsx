'use client';

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ChevronDown, 
  Loader2, 
  FolderOpen,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Vault {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  createdAt?: string;
}

interface VaultSelectorProps {
  selectedVaultId: string | null;
  onVaultSelect: (vaultId: string | null) => void;
}

export default function VaultSelector({ selectedVaultId, onVaultSelect }: VaultSelectorProps) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchVaults = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/vaults');
      if (!response.ok) {
        throw new Error('Failed to fetch vaults');
      }
      const data = await response.json();
      // Handle both array response and object with vaults property
      const vaultList = Array.isArray(data) ? data : (data.vaults || []);
      setVaults(vaultList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vaults');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVaults();
  }, []);

  const selectedVault = vaults.find(v => v.id === selectedVaultId);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Select Collection
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className={`
            w-full flex items-center justify-between gap-2 px-4 py-2.5 
            bg-white border rounded-lg text-left
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
            ${isLoading ? 'opacity-75 cursor-wait' : 'hover:border-gray-400'}
            transition-all
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
            ) : (
              <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className={`truncate ${selectedVault ? 'text-gray-900' : 'text-gray-500'}`}>
              {isLoading 
                ? 'Loading collections...' 
                : selectedVault 
                  ? selectedVault.name 
                  : 'Select a collection to browse documents'
              }
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {/* Refresh button */}
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{vaults.length} collection{vaults.length !== 1 ? 's' : ''} available</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchVaults();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Refresh collections"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clear selection option */}
            {selectedVaultId && (
              <button
                onClick={() => {
                  onVaultSelect(null);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100"
              >
                <FolderOpen className="w-4 h-4" />
                Clear selection (upload new documents)
              </button>
            )}

            {/* Error state */}
            {error && (
              <div className="px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Collection list */}
            {vaults.length === 0 && !error ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p>No previous uploads found</p>
                <p className="text-xs mt-1">Upload documents to get started</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-auto">
                {vaults.map((vault) => (
                  <button
                    key={vault.id}
                    onClick={() => {
                      onVaultSelect(vault.id);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                      ${selectedVaultId === vault.id ? 'bg-blue-50' : ''}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Database className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        selectedVaultId === vault.id ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${
                          selectedVaultId === vault.id ? 'text-blue-700' : 'text-gray-900'
                        }`}>
                          {vault.name}
                        </p>
                        {vault.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {vault.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {vault.documentCount !== undefined 
                            ? `${vault.documentCount} document${vault.documentCount !== 1 ? 's' : ''}`
                            : 'Click to browse documents'
                          }
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
