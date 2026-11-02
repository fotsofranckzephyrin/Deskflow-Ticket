import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { CLEAN_ARCH_LAYERS, TECHNICAL_STRENGTHS } from '../../services/cleanArchData';

export const ArchitectureView: React.FC = () => {
  const [selectedLayerId, setSelectedLayerId] = useState<string>('domain');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const activeLayer =
    CLEAN_ARCH_LAYERS.find((l) => l.id === selectedLayerId) || CLEAN_ARCH_LAYERS[0];

  const handleCopyCode = (filename: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
            Architecture Backend Go, Gin & PostgreSQL
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Structure Clean Architecture hexagonale, conteneurisation Docker et sécurité JWT.
          </p>
        </div>
      </div>

      {/* Layer Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {CLEAN_ARCH_LAYERS.map((layer) => {
          const isSelected = layer.id === activeLayer.id;
          return (
            <button
              key={layer.id}
              onClick={() => setSelectedLayerId(layer.id)}
              className={`p-3 rounded-md border text-left transition-colors ${
                isSelected
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <div className="text-xs font-semibold">{layer.name}</div>
              <div
                className={`text-[11px] mt-0.5 line-clamp-1 ${
                  isSelected ? 'text-neutral-300' : 'text-neutral-500'
                }`}
              >
                {layer.role}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Layer Details */}
      <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{activeLayer.name}</h2>
          <p className="text-xs text-neutral-600 mt-0.5">{activeLayer.role}</p>
        </div>

        {/* Principles */}
        <div className="p-3.5 rounded-md bg-neutral-50 border border-neutral-200 space-y-1.5 text-xs text-neutral-700">
          <div className="font-medium text-neutral-900">Principes d'ingénierie logicielle :</div>
          <ul className="list-disc list-inside space-y-1 text-neutral-600">
            {activeLayer.principles.map((pr, idx) => (
              <li key={idx}>{pr}</li>
            ))}
          </ul>
        </div>

        {/* Code Viewers */}
        <div className="space-y-3 pt-2">
          {activeLayer.files.map((file) => (
            <div
              key={file.path}
              className="rounded-md border border-neutral-200 overflow-hidden bg-neutral-900 text-neutral-100"
            >
              <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-800/80 border-b border-neutral-700 text-xs">
                <span className="font-mono text-[11px] text-neutral-300">
                  {file.path}
                </span>
                <button
                  onClick={() => handleCopyCode(file.path, file.code)}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
                >
                  {copiedFile === file.path ? (
                    <>
                      <Check className="w-3 h-3 text-neutral-300" />
                      <span>Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3.5 overflow-x-auto text-[11px] font-mono leading-relaxed text-neutral-200">
                <pre>{file.code}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Technical Strengths for Recruitment Interviews */}
      <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 pb-2 border-b border-neutral-200">
          Arguments Clés pour l'Entretien d'Embauche
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TECHNICAL_STRENGTHS.map((str, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-md bg-neutral-50 border border-neutral-200 space-y-1.5 text-xs"
            >
              <div className="font-semibold text-neutral-900">{str.title}</div>
              <p className="text-neutral-600 leading-relaxed text-[11px]">
                {str.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* REST API & Docker Instructions */}
      <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-neutral-900 pb-2 border-b border-neutral-200">
          Commandes de Déploiement Docker & Tests REST
        </h2>

        <div className="space-y-3">
          <div>
            <div className="font-medium text-neutral-700 mb-1">
              1. Lancement de la stack complète (PostgreSQL 16 + Go Gin API) :
            </div>
            <pre className="p-2.5 rounded bg-neutral-900 text-neutral-200 font-mono text-[11px]">
              docker compose up --build -d
            </pre>
          </div>

          <div>
            <div className="font-medium text-neutral-700 mb-1">
              2. Exemple d'authentification REST API (cURL) :
            </div>
            <pre className="p-2.5 rounded bg-neutral-900 text-neutral-200 font-mono text-[11px]">
              {`curl -X POST http://localhost:8081/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@deskflow.io", "password": "password123"}'`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
