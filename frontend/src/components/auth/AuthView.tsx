import React, { useEffect, useState } from 'react';
import { ChevronDown, UserRoundCheck } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '../../traduction';

interface AuthViewProps {
  mode: 'LOGIN' | 'REGISTER';
  onModeChange: (mode: 'LOGIN' | 'REGISTER') => void;
  onLogin: (identifier: string, password?: string) => Promise<boolean>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onResetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  onRegister: (
    fullName: string,
    email: string,
    department: string,
    password: string,
    matricule?: string
  ) => Promise<unknown>;
  departments?: string[];
}

const DEFAULT_DEPARTMENTS = [
  'Direction des Systèmes d\'Information (DSI)',
  'Direction Financière & Comptabilité',
  'Direction des Ressources Humaines',
  'Direction Commerciale & Marketing',
  'Direction des Opérations & Logistique',
  'Support & Infrastructure IT',
  'Direction Juridique & Conformité',
  'Direction Audit & Contrôle de Gestion',
];

export const AuthView: React.FC<AuthViewProps> = ({
  mode,
  onModeChange,
  onLogin,
  onRequestPasswordReset,
  onResetPassword,
  onRegister,
  departments = DEFAULT_DEPARTMENTS,
}) => {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [matricule, setMatricule] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState(departments[0] || 'Direction Générale');
  const [regPassword, setRegPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    if (departments.length > 0 && !departments.includes(department)) setDepartment(departments[0]);
  }, [departments, department]);

  const handleRequestResetCode = async () => {
    setError(null);
    setResetNotice(null);
    try {
      await onRequestPasswordReset(resetEmail);
      setResetCodeSent(true);
      setResetNotice('Si cette adresse est associée à un compte, un code a été envoyé. Vérifiez également vos courriers indésirables.');
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : 'Impossible d’envoyer le code.');
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    try {
      await onResetPassword(resetEmail, resetCode, newPassword);
      setResetMode(false);
      setResetCodeSent(false);
      setResetCode('');
      setNewPassword('');
      setPassword('');
      setResetNotice('Mot de passe modifié. Vous pouvez vous connecter.');
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : 'La réinitialisation a échoué.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'REGISTER') {
      if (!fullName.trim() || !email.trim() || !department.trim() || !regPassword.trim()) {
        setError('Tous les champs obligatoires (nom, e-mail, département, mot de passe) doivent être renseignés.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Veuillez saisir une adresse e-mail valide.');
        return;
      }
      if (regPassword.length < 8) {
        setError('Le mot de passe doit comporter au moins 8 caractères.');
        return;
      }
      try {
        await onRegister(fullName, email, department, regPassword, matricule);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte.');
      }
    } else {
      if (!identifier.trim() || !password.trim()) {
        setError('Veuillez renseigner votre identifiant et votre mot de passe.');
        return;
      }
      try {
        const ok = await onLogin(identifier.trim(), password);
        if (!ok) setError('Identifiants incorrects ou compte inactif. Vérifiez vos accès.');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Connexion impossible. Réessayez.');
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FBFBFB] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight text-neutral-900">
            {t('DeskFlow')}
          </span>
          <p className="mt-1 text-xs text-neutral-500">
            {t("Plateforme d'Assistance Interne & Gestion des Services IT")}
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-neutral-200 rounded-md shadow-sm overflow-hidden">
          {/* Onglets Connexion / Inscription */}
          <div className="flex border-b border-neutral-200 bg-neutral-50 text-xs">
            <button
              type="button"
              onClick={() => {
                onModeChange('LOGIN');
                setError(null);
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                mode === 'LOGIN'
                  ? 'bg-white text-neutral-900 border-b-2 border-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t('Connexion')}
            </button>
            <button
              type="button"
              onClick={() => {
                onModeChange('REGISTER');
                setError(null);
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                mode === 'REGISTER'
                  ? 'bg-white text-neutral-900 border-b-2 border-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t('Créer un compte')}
            </button>
          </div>

          <div className="p-5 sm:p-7 space-y-4">
            {resetNotice && (
              <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {resetNotice}
              </div>
            )}
            {error && (
              <div role="alert" className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-800 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
              {mode === 'REGISTER' && (
                <>
                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      {t('Nom et Prénom')}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t('Ex: Camille Bernard')}
                      className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-neutral-900 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      {t('Matricule professionnel / Identifiant agent')}
                    </label>
                    <input
                      type="text"
                      value={matricule}
                      onChange={(e) => setMatricule(e.target.value)}
                      placeholder={t('Ex: MAT-2026-441')}
                      className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-neutral-900 focus:outline-none focus:border-neutral-500 font-mono text-xs"
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
                      placeholder={t('nom@entreprise.com')}
                      className="w-full bg-white border border-neutral-300 rounded px-3 py-2 font-mono text-neutral-900 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      {t('Mot de passe personnel')}
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder={t('Définissez votre mot de passe...')}
                      className="w-full bg-white border border-neutral-300 rounded px-3 py-2 font-mono text-neutral-900 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      {t('Département / Direction de rattachement')}
                    </label>
                    <div className="relative">
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-neutral-900 focus:outline-none focus:border-neutral-500 text-xs appearance-none pr-8 cursor-pointer"
                      >
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700">
                      <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900">                      {t('Votre espace DeskFlow')}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                        Votre compte sera créé avec le profil{' '}
                        <span className="ml-1 inline-flex items-center rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-medium text-neutral-800">
                          {t('Collaborateur')}
                        </span>
                        . {t('Vous pourrez créer vos demandes et suivre leur traitement depuis votre espace.')}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {mode === 'LOGIN' && (
                <>
                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      {t('Identifiant ou e-mail professionnel')}
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Saisissez votre e-mail ou identifiant..."
                      className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-neutral-900 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      {t('Mot de passe')}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-neutral-300 rounded px-3 py-2 font-mono text-neutral-900 focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
              >
                {mode === 'REGISTER' ? t('Créer mon compte') : t('Se connecter')}
              </button>
            </form>
            {mode === 'LOGIN' && !resetMode && (
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setResetNotice(null);
                  setError(null);
                }}
                className="text-xs font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
              >
                {t('Mot de passe oublié ?')}
              </button>
            )}
            {mode === 'LOGIN' && resetMode && (
              <section className="space-y-3 border-t border-neutral-200 pt-4 text-xs">
                <h2 className="font-semibold text-neutral-900">{t('Réinitialiser le mot de passe')}</h2>
                <label className="block text-neutral-700">
                  {t('Adresse e-mail professionnelle')}
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    autoComplete="email"
                  />
                </label>
                {!resetCodeSent ? (
                  <button type="button" onClick={() => void handleRequestResetCode()} className="w-full rounded bg-neutral-900 py-2 text-white">
                    {t('Envoyer le code')}
                  </button>
                ) : (
                  <>
                    <label className="block text-neutral-700">
                      {t('Code reçu par e-mail')}
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                      />
                    </label>
                    <label className="block text-neutral-700">
                      {t('Nouveau mot de passe')}
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                        autoComplete="new-password"
                      />
                    </label>
                    <button type="button" onClick={() => void handleResetPassword()} className="w-full rounded bg-neutral-900 py-2 text-white">
                      {t('Réinitialiser le mot de passe')}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => { setResetMode(false); setError(null); }} className="text-neutral-600 underline">
                  {t('Retour à la connexion')}
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
