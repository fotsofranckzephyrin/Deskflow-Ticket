import React, { useState } from 'react';
import { Shield, Check } from 'lucide-react';
import { useLanguage } from '../../traduction';

interface FirstLoginPasswordModalProps {
  isOpen: boolean;
  userName: string;
  onChangePassword: (newPassword: string) => void;
}

export const FirstLoginPasswordModal: React.FC<FirstLoginPasswordModalProps> = ({
  isOpen,
  userName,
  onChangePassword,
}) => {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.trim().length < 4) {
      setError('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }

    if (newPassword === '1234') {
      setError('Vous ne pouvez pas réutiliser le mot de passe temporaire par défaut (1234).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    onChangePassword(newPassword.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-md bg-white border border-neutral-300 rounded-md shadow-lg overflow-hidden text-neutral-900">
        <div className="p-5 border-b border-neutral-200 bg-neutral-50 flex items-center gap-3">
          <div className="p-2 bg-neutral-900 text-white rounded">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Première Connexion — Sécurisation du Compte
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Bienvenue, {userName}. Veuillez définir votre mot de passe personnel.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px]">
            Votre compte a été créé avec le mot de passe temporaire par défaut (<strong>1234</strong>). Conformément à la politique de sécurité, vous devez obligatoirement choisir un nouveau mot de passe personnel.
          </div>

          {error && (
            <div className="p-2.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-neutral-700 font-medium mb-1">
              {t('Nouveau mot de passe personnel')}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-neutral-900 font-mono text-xs focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div>
            <label className="block text-neutral-700 font-medium mb-1">
              {t('Confirmer le mot de passe')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-neutral-900 font-mono text-xs focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{t('Valider et Accéder à mon Espace')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
