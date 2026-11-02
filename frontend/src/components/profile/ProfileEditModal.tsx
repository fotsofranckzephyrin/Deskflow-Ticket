import React, { useEffect, useState } from 'react';
import { X, Check, User as UserIcon } from 'lucide-react';
import { User } from '../../types';
import { useLanguage } from '../../traduction';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (updates: {
    fullName: string;
    email: string;
  }) => Promise<void>;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose, user, onSave }) => {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(user.fullName);
    setEmail(user.email);
    setError(null);
    setSuccess(false);
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!fullName.trim() || !email.trim()) {
      setError(t('Le nom et l’e-mail sont obligatoires.'));
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        fullName: fullName.trim(),
        email: email.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? t(err.message) : t('Erreur lors de la mise à jour.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 font-sans">
      <div className="w-full max-w-md bg-white border border-neutral-300 rounded-md shadow-lg overflow-hidden text-neutral-900 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-neutral-800" />
            <h2 className="text-sm font-semibold text-neutral-900">
              {t('Modifier mes Informations Personnelles')}
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-800">
              {error}
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
              {t('Vos informations ont été mises à jour avec succès !')}
            </div>
          )}

          <div>
            <label className="block text-neutral-700 font-medium mb-1">
              {t('Nom complet')}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div>
            <label className="block text-neutral-700 font-medium mb-1">
              {t('Adresse e-mail professionnelle')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 font-mono text-neutral-900 focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div>
            <label className="block text-neutral-700 font-medium mb-1">{t('Matricule agent / identifiant')}</label>
            <input
              type="text"
              value={user.matricule || ''}
              readOnly
              className="w-full bg-neutral-100 border border-neutral-300 rounded px-3 py-1.5 font-mono text-neutral-600"
            />
            <p className="mt-1 text-[11px] text-neutral-500">{t('Seul un administrateur peut modifier le matricule.')}</p>
          </div>

          <div>
            <label className="block text-neutral-700 font-medium mb-1">{t('Département / Direction')}</label>
            <input
              type="text"
              value={user.department}
              readOnly
              className="w-full bg-neutral-100 border border-neutral-300 rounded px-3 py-1.5 text-neutral-600"
            />
            <p className="mt-1 text-[11px] text-neutral-500">{t('Contactez un administrateur pour modifier votre rattachement.')}</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 font-medium"
            >
              {t('Annuler')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3.5 py-1.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? t('Enregistrement…') : t('Enregistrer les modifications')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
